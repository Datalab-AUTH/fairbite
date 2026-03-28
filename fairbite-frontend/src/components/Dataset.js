// Dataset.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ArrowUpIcon from '../icons/keyboard_arrow_up.svg';
import TableIcon from '../icons/Table.svg';
import {
    getDatasetStatus,
    getDatasetReport,
    createRepresentationAudit,
    getRepresentationAuditStatus,
    getRepresentationAuditResults
} from "../api";

/* =========================
   Performance Tuning
   ========================= */

const FILTER_CHUNK_SIZE = 500;
const FILTER_PROGRESS_COMMIT_EVERY = 1500;
const INITIAL_VISIBLE_CARDS = 24;
const LOAD_MORE_CARDS = 24;

/* =========================
   Sensitivity UI Helpers
   ========================= */

const sensitivityColor = (s) => {
    const v = Number(s);
    if (v >= 90) return "#47AD33";
    if (v >= 60) return "#ADD633";
    if (v >= 30) return "#FFD934";
    if (v >= 1) return "#FFB234";
    return "#C34E4E";
};

const categoricalColor = (isCat) => (isCat ? "#47AD33" : "#C34E4E");

const sortBySensitivityDesc = (arr) =>
    [...arr].sort((a, b) => (b?.sensitivity ?? 0) - (a?.sensitivity ?? 0));

const chunkIntoTwoColumns = (arr) => {
    const mid = Math.ceil(arr.length / 2);
    return [arr.slice(0, mid), arr.slice(mid)];
};

const SensRow = ({ col }) => {
    const sens = Number(col?.sensitivity ?? 0);
    const sensBg = sensitivityColor(sens);
    const catCol = categoricalColor(!!col?.is_categorical);

    return (
        <div className="sens-row">
            <div className="sens-colname" title={col?.reason || ""}>
                {col?.key}
            </div>

            <div className="sens-pill" style={{ backgroundColor: sensBg }}>
                {sens}%
            </div>

            <div
                className="cat-pill"
                style={{
                    borderColor: catCol,
                    color: catCol,
                }}
            >
                {col?.is_categorical ? "yes" : "no"}
            </div>
        </div>
    );
};

const RecordsetSensitivity = ({
    recordset,
    isExpanded,
    onToggleExpand,
    collapsedCount = 10,
}) => {
    const sorted = sortBySensitivityDesc(recordset?.results || []);
    const visible = isExpanded ? sorted : sorted.slice(0, collapsedCount);
    const [left, right] = chunkIntoTwoColumns(visible);

    const ColumnHeader = () => (
        <div className="sens-col-header">
            <span className="sens-h-col">Column</span>
            <span className="sens-h-sens">Sensitivity</span>
            <span className="sens-h-cat">Categorical</span>
        </div>
    );

    return (
        <div className="sens-recordset-card">
            <div className="sens-recordset-topbar">
                <div className="recordset-title-group">
                    <img src={TableIcon} alt="" className="recordset-icon" />
                    <span className="recordset-name">{recordset.recordset_name}</span>
                </div>
            </div>

            <hr className="sens-recordset-divider" />

            <div className="sens-two-col-wrap">
                <div className="sens-side">
                    <ColumnHeader />
                    <div className="sens-side-body">
                        {left.map((c, idx) => (
                            <SensRow
                                key={`${recordset?.recordset_name || "rs"}-L-${c?.key || idx}-${idx}`}
                                col={c}
                            />
                        ))}
                    </div>
                </div>

                <div className="sens-side">
                    <ColumnHeader />
                    <div className="sens-side-body">
                        {right.map((c, idx) => (
                            <SensRow
                                key={`${recordset?.recordset_name || "rs"}-R-${c?.key || idx}-${idx}`}
                                col={c}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="sens-actions">
                <button className="link-btn" onClick={onToggleExpand}>
                    {isExpanded ? "View less" : "View all"}
                </button>
            </div>
        </div>
    );
};

const AttributeSensitivityAnalysis = ({
    recordsets,
    expandedMap,
    setExpandedMap,
}) => {
    if (!recordsets?.length) return null;

    return (
        <div className="audit-card">
            <h3 className="section-header">Attribute Sensitivity Analysis</h3>
            <hr className="sens-divider" />

            <div style={{ marginTop: 18 }}>
                {recordsets.map((rs) => {
                    const key = rs?.recordset_name || "unknown_recordset";
                    const isExpanded = !!expandedMap[key];

                    return (
                        <RecordsetSensitivity
                            key={key}
                            recordset={rs}
                            isExpanded={isExpanded}
                            onToggleExpand={() =>
                                setExpandedMap((prev) => ({
                                    ...prev,
                                    [key]: !prev[key],
                                }))
                            }
                            collapsedCount={10}
                        />
                    );
                })}
            </div>
        </div>
    );
};

/* =========================
   Tooltip UI
   ========================= */

const InfoTooltip = ({ text }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <span
            className="param-tooltip-wrap"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onFocus={() => setIsVisible(true)}
            onBlur={() => setIsVisible(false)}
            tabIndex={0}
        >
            <span className="param-tooltip-icon" aria-label="More information">
                i
            </span>

            {isVisible && (
                <span className="param-tooltip-bubble" role="tooltip">
                    {text}
                </span>
            )}
        </span>
    );
};

const AuditParamLabel = ({ label, tooltip }) => {
    return (
        <label className="input-label audit-param-label">
            <span>{label}</span>
            <InfoTooltip text={tooltip} />
        </label>
    );
};

/* =========================
   Representation Audit UI Helpers
   ========================= */

const getUniqueValueCount = (representation, attribute) => {
    if (!representation?.levels) return 0;
    const uniqueValues = new Set();

    Object.values(representation.levels).forEach(levelGroups => {
        levelGroups.forEach(group => {
            if (group.attributes && group.attributes.includes(attribute) && group.values) {
                const attrIndex = group.attributes.indexOf(attribute);
                if (attrIndex >= 0 && attrIndex < group.values.length) {
                    uniqueValues.add(group.values[attrIndex]);
                }
            }
        });
    });

    return uniqueValues.size;
};

const countFlaggedGroups = (representation) => {
    if (!representation?.levels) return 0;
    let flagged = 0;

    Object.values(representation.levels).forEach(levelGroups => {
        levelGroups.forEach(group => {
            if (group.category && group.category !== 'well_represented') {
                flagged++;
            }
        });
    });

    return flagged;
};

const calculateLevelSummary = (levelGroups) => {
    if (!levelGroups || !Array.isArray(levelGroups)) {
        return { not_represented: 0, under_represented: 0, well_represented: 0, over_represented: 0, total: 0 };
    }

    const summary = {
        not_represented: 0,
        under_represented: 0,
        well_represented: 0,
        over_represented: 0,
        total: levelGroups.length
    };

    levelGroups.forEach(group => {
        const cat = group.category;
        if (cat === 'not_represented') summary.not_represented++;
        else if (cat === 'under_represented') summary.under_represented++;
        else if (cat === 'well_represented') summary.well_represented++;
        else if (cat === 'over_represented') summary.over_represented++;
    });

    return summary;
};

const calculateTotalSummary = (representation) => {
    if (!representation?.levels) {
        return { not_represented: 0, under_represented: 0, well_represented: 0, over_represented: 0, total: 0 };
    }

    const total = { not_represented: 0, under_represented: 0, well_represented: 0, over_represented: 0, total: 0 };

    Object.values(representation.levels).forEach(levelGroups => {
        const levelSummary = calculateLevelSummary(levelGroups);
        total.not_represented += levelSummary.not_represented;
        total.under_represented += levelSummary.under_represented;
        total.well_represented += levelSummary.well_represented;
        total.over_represented += levelSummary.over_represented;
        total.total += levelSummary.total;
    });

    return total;
};

const countFlaggedGroupsForLevel = (levelGroups) => {
    if (!levelGroups || !Array.isArray(levelGroups)) return 0;
    return levelGroups.filter(g => g.category && g.category !== 'well_represented').length;
};

/* =========================
   Representation Audit Results UI
   ========================= */

const formatPercentage = (value) => {
    if (value === null || value === undefined) return '-';
    const percentage = value * 100;
    return percentage.toFixed(4).replace(/\.?0+$/, '') + '%';
};

const getCategoryStyle = (category) => {
    switch (category) {
        case 'not_represented':
            return { bg: '#D9D9D9', label: 'Not-Represented', icon: '×' };
        case 'under_represented':
            return { bg: '#FDCC69', label: 'Under-Represented', icon: '↓' };
        case 'well_represented':
            return { bg: '#6D9235', label: 'Well-Represented', icon: '→' };
        case 'over_represented':
            return { bg: '#D04F50', label: 'Over-Represented', icon: '↑' };
        default:
            return { bg: '#E0E0E0', label: category || 'Unknown', icon: '' };
    }
};

const GroupCard = React.memo(({ group }) => {
    const { attributes, values, count, proportion, equal_share, category } = group;
    const categoryStyle = getCategoryStyle(category);

    const headerText = attributes.map((attr, idx) =>
        `${attr} = ${values[idx] || ''}`
    ).join(', ');

    return (
        <div className="group-card">
            <div className="group-card-header">
                <strong>{headerText}</strong>
            </div>
            <div className="group-card-body">
                <div className="group-card-stat">
                    <span className="group-card-label">Observed:</span>
                    <span className="group-card-value"><strong>{formatPercentage(proportion)}</strong></span>
                </div>
                <div className="group-card-stat">
                    <span className="group-card-label">Expected:</span>
                    <span className="group-card-value">{formatPercentage(equal_share)}</span>
                </div>
                <div className="group-card-category" style={{ backgroundColor: categoryStyle.bg }}>
                    <span className="group-card-category-icon">{categoryStyle.icon}</span>
                    <strong>{categoryStyle.label}</strong>
                </div>
                <div className="group-card-stat">
                    <span className="group-card-label">Records:</span>
                    <span className="group-card-value">{count}</span>
                </div>
            </div>
        </div>
    );
});

const extractAvailableAttributes = (levelGroups) => {
    const attrMap = {};

    levelGroups.forEach(group => {
        if (group.attributes && group.values) {
            group.attributes.forEach((attr, idx) => {
                if (!attrMap[attr]) {
                    attrMap[attr] = new Set();
                }
                if (group.values[idx] !== undefined && group.values[idx] !== null && group.values[idx] !== '') {
                    attrMap[attr].add(String(group.values[idx]));
                }
            });
        }
    });

    const result = {};
    Object.keys(attrMap).forEach(attr => {
        result[attr] = Array.from(attrMap[attr]).sort((a, b) => a.localeCompare(b));
    });

    return result;
};

/* =========================
   Search Helpers
   ========================= */

const normalizeSearchToken = (value) =>
    String(value ?? '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .toLowerCase();

const groupMatchesSearch = (group, searchPairs) => {
    if (!searchPairs || searchPairs.length === 0) return true;

    const attributes = Array.isArray(group?.attributes) ? group.attributes : [];
    const values = Array.isArray(group?.values) ? group.values : [];

    const groupMap = new Map();
    attributes.forEach((attr, idx) => {
        groupMap.set(
            normalizeSearchToken(attr),
            normalizeSearchToken(values[idx])
        );
    });

    return searchPairs.every(({ attribute, value }) => {
        return groupMap.has(attribute) && groupMap.get(attribute) === value;
    });
};

const buildSearchDisplay = (pairs) =>
    pairs.map(pair => `${pair.attribute} = ${pair.value}`).join(', ');

/* =========================
   Progressive Grid
   ========================= */

const ProgressiveGroupsGrid = ({
    groups,
    isFiltering,
    processedCount,
    totalSourceCount,
}) => {
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_CARDS);
    const sentinelRef = useRef(null);

    useEffect(() => {
        setVisibleCount(INITIAL_VISIBLE_CARDS);
    }, [groups]);

    useEffect(() => {
        const node = sentinelRef.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting) return;

                setVisibleCount((prev) =>
                    Math.min(prev + LOAD_MORE_CARDS, groups.length)
                );
            },
            {
                root: null,
                rootMargin: '300px',
                threshold: 0,
            }
        );

        observer.observe(node);

        return () => observer.disconnect();
    }, [groups.length]);

    const visibleGroups = groups.slice(0, visibleCount);
    const hasMore = visibleCount < groups.length;

    return (
        <div className="groups-grid-container">
            {visibleGroups.length > 0 ? (
                <>
                    <div className="groups-grid">
                        {visibleGroups.map((group, idx) => (
                            <GroupCard
                                key={`${group?.attributes?.join('|') || 'g'}-${group?.values?.join('|') || idx}-${idx}`}
                                group={group}
                            />
                        ))}
                    </div>

                    <div
                        ref={sentinelRef}
                        style={{ height: 1, width: '100%' }}
                    />

                    {(hasMore || isFiltering) && (
                        <div
                            style={{
                                textAlign: 'center',
                                padding: '18px 8px',
                                color: '#6B7280',
                                fontSize: 13
                            }}
                        >
                            {hasMore
                                ? `Showing ${visibleGroups.length} of ${groups.length} loaded matching groups`
                                : `Loaded ${groups.length} matching groups`}
                            {isFiltering && totalSourceCount > 0
                                ? ` • filtering ${Math.min(processedCount, totalSourceCount)} / ${totalSourceCount} source groups...`
                                : ''}
                        </div>
                    )}
                </>
            ) : isFiltering ? (
                <div style={{ textAlign: 'center', padding: '28px', color: '#666' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
                    <p>Loading matching groups...</p>
                    <p style={{ fontSize: 13, color: '#888' }}>
                        Processed {Math.min(processedCount, totalSourceCount)} / {totalSourceCount}
                    </p>
                </div>
            ) : (
                <div className="no-groups-message">
                    No available results
                </div>
            )}
        </div>
    );
};

const LevelBreakdown = ({ level, levelGroups }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filterCategory, setFilterCategory] = useState('all');

    const [searchDraft, setSearchDraft] = useState([]);
    const [appliedSearch, setAppliedSearch] = useState([]);

    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteOptions, setAutocompleteOptions] = useState([]);
    const [autocompleteType, setAutocompleteType] = useState('attribute');
    const [selectedAttribute, setSelectedAttribute] = useState(null);

    const [filteredGroups, setFilteredGroups] = useState([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [processedCount, setProcessedCount] = useState(0);

    const searchInputRef = useRef(null);
    const autocompleteRef = useRef(null);

    const flaggedCount = countFlaggedGroupsForLevel(levelGroups);
    const totalSourceCount = Array.isArray(levelGroups) ? levelGroups.length : 0;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                autocompleteRef.current &&
                !autocompleteRef.current.contains(event.target) &&
                searchInputRef.current &&
                !searchInputRef.current.contains(event.target)
            ) {
                setShowAutocomplete(false);
            }
        };

        if (showAutocomplete) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showAutocomplete]);

    const availableAttrs = useMemo(
        () => extractAvailableAttributes(levelGroups || []),
        [levelGroups]
    );

    useEffect(() => {
        if (!isOpen) {
            setFilteredGroups([]);
            setIsFiltering(false);
            setProcessedCount(0);
            return;
        }

        if (!levelGroups || !Array.isArray(levelGroups)) {
            setFilteredGroups([]);
            setIsFiltering(false);
            setProcessedCount(0);
            return;
        }

        let cancelled = false;
        let index = 0;
        let lastCommittedAt = 0;
        const nextResults = [];

        const matchesCategory = (group) => {
            if (filterCategory === 'all') return true;
            if (filterCategory === 'not_represented') return group.category === 'not_represented';
            if (filterCategory === 'under_represented') return group.category === 'under_represented';
            if (filterCategory === 'well_represented') return group.category === 'well_represented';
            if (filterCategory === 'over_represented') return group.category === 'over_represented';
            return true;
        };

        const processChunk = () => {
            if (cancelled) return;

            const upper = Math.min(index + FILTER_CHUNK_SIZE, levelGroups.length);

            for (; index < upper; index++) {
                const group = levelGroups[index];
                if (!matchesCategory(group)) continue;
                if (appliedSearch.length > 0 && !groupMatchesSearch(group, appliedSearch)) continue;
                nextResults.push(group);
            }

            const processed = upper;
            setProcessedCount(processed);

            if (
                nextResults.length - lastCommittedAt >= FILTER_PROGRESS_COMMIT_EVERY ||
                processed >= levelGroups.length
            ) {
                lastCommittedAt = nextResults.length;
                setFilteredGroups([...nextResults]);
            }

            if (processed < levelGroups.length) {
                requestAnimationFrame(processChunk);
            } else {
                setFilteredGroups([...nextResults]);
                setIsFiltering(false);
            }
        };

        setFilteredGroups([]);
        setProcessedCount(0);
        setIsFiltering(true);

        requestAnimationFrame(processChunk);

        return () => {
            cancelled = true;
        };
    }, [isOpen, levelGroups, filterCategory, appliedSearch]);

    const openAttributeAutocomplete = (draft = searchDraft) => {
        const usedAttrs = draft.map(p => p.attribute);

        const available = Object.keys(availableAttrs).filter(attr => {
            const normalizedAttr = normalizeSearchToken(attr);
            return !usedAttrs.includes(normalizedAttr);
        });

        setAutocompleteType('attribute');
        setSelectedAttribute(null);
        setAutocompleteOptions(available);
        setShowAutocomplete(available.length > 0);
    };

    const openValueAutocomplete = (attribute) => {
        const values = availableAttrs[attribute] || [];
        setAutocompleteType('value');
        setSelectedAttribute(attribute);
        setAutocompleteOptions(values);
        setShowAutocomplete(values.length > 0);
    };

    const handleSearchFocus = () => {
        if (autocompleteType === 'value' && selectedAttribute) {
            openValueAutocomplete(selectedAttribute);
            return;
        }

        openAttributeAutocomplete();
    };

    const handleAutocompleteSelect = (option) => {
        if (autocompleteType === 'attribute') {
            openValueAutocomplete(option);
            return;
        }

        if (autocompleteType === 'value' && selectedAttribute) {
            const nextDraft = [
                ...searchDraft,
                {
                    attribute: normalizeSearchToken(selectedAttribute),
                    value: normalizeSearchToken(option),
                }
            ];

            setSearchDraft(nextDraft);
            setSelectedAttribute(null);
            setAutocompleteType('attribute');

            const usedAttrs = nextDraft.map(p => p.attribute);
            const remainingAttrs = Object.keys(availableAttrs).filter(attr => {
                const normalizedAttr = normalizeSearchToken(attr);
                return !usedAttrs.includes(normalizedAttr);
            });

            setAutocompleteOptions(remainingAttrs);
            setShowAutocomplete(remainingAttrs.length > 0);
        }
    };

    const handleApplySearch = () => {
        setAppliedSearch([...searchDraft]);
        setShowAutocomplete(false);
    };

    const clearSearch = () => {
        setSearchDraft([]);
        setAppliedSearch([]);
        setShowAutocomplete(false);
        setSelectedAttribute(null);
        setAutocompleteType('attribute');
    };

    const removeLastPair = () => {
        const nextDraft = searchDraft.slice(0, -1);
        setSearchDraft(nextDraft);
        setAppliedSearch(nextDraft);
        setSelectedAttribute(null);
        setAutocompleteType('attribute');
        openAttributeAutocomplete(nextDraft);
    };

    const draftDisplay = useMemo(() => buildSearchDisplay(searchDraft), [searchDraft]);
    const hasPendingChanges =
        JSON.stringify(searchDraft) !== JSON.stringify(appliedSearch);

    return (
        <div className="level-breakdown-item">
            <div
                className="level-breakdown-header"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="level-breakdown-title">
                    Level {level} ({level === '1' ? 'single attributes' : 'attribute intersection'}): {flaggedCount} flagged groups
                </span>
                <img
                    src={ArrowUpIcon}
                    alt="Toggle"
                    className="toggle-icon"
                    style={{
                        transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)'
                    }}
                />
            </div>

            {isOpen && (
                <div className="level-breakdown-content">
                    <div className="level-breakdown-controls">
                        <div className="level-filter-group">
                            <label className="level-filter-label">Show:</label>
                            <select
                                className="level-filter-select"
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                            >
                                <option value="all">All</option>
                                {level !== '1' && <option value="not_represented">Not-Represented</option>}
                                <option value="under_represented">Under-Represented</option>
                                <option value="well_represented">Well-Represented</option>
                                <option value="over_represented">Over-Represented</option>
                            </select>
                        </div>

                        <div className="level-search-group" ref={autocompleteRef}>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="level-search-input"
                                placeholder="Build search using autocomplete"
                                value={draftDisplay}
                                readOnly
                                onClick={handleSearchFocus}
                                onFocus={handleSearchFocus}
                            />

                            {searchDraft.length > 0 && (
                                <>
                                    <button
                                        type="button"
                                        className="level-search-apply"
                                        onClick={handleApplySearch}
                                        disabled={!hasPendingChanges}
                                    >
                                        Apply
                                    </button>

                                    <button
                                        type="button"
                                        className="level-search-clear"
                                        onClick={removeLastPair}
                                    >
                                        Remove Last
                                    </button>

                                    <button
                                        type="button"
                                        className="level-search-clear"
                                        onClick={clearSearch}
                                    >
                                        Clear All
                                    </button>
                                </>
                            )}

                            {showAutocomplete && autocompleteOptions.length > 0 && (
                                <div className="autocomplete-dropdown">
                                    {autocompleteOptions.map((option, idx) => (
                                        <div
                                            key={idx}
                                            className="autocomplete-option"
                                            onClick={() => handleAutocompleteSelect(option)}
                                        >
                                            {autocompleteType === 'attribute'
                                                ? option
                                                : `${selectedAttribute} = ${option}`}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <ProgressiveGroupsGrid
                        groups={filteredGroups}
                        isFiltering={isFiltering}
                        processedCount={processedCount}
                        totalSourceCount={totalSourceCount}
                    />
                </div>
            )}
        </div>
    );
};

const RecordsetAuditResult = ({ recordsetData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const representation = recordsetData?.representation;

    if (!representation) {
        return (
            <div className="rep-audit-recordset-item">
                <div className="rep-audit-recordset-header">
                    <div className="recordset-title-group">
                        <img src={TableIcon} alt="" className="recordset-icon" />
                        <span className="recordset-name">{recordsetData?.recordset_name || 'Unknown'}</span>
                    </div>
                    <span className="rep-audit-error">Could not parse recordset data</span>
                </div>
            </div>
        );
    }

    const sensitiveColumns = representation.sensitive_columns || [];
    const numSensitiveAttrs = sensitiveColumns.length;
    const flaggedGroups = countFlaggedGroups(representation);
    const maxLevel = representation.parameters?.max_level || Object.keys(representation.levels || {}).length;
    const totalSummary = calculateTotalSummary(representation);

    const sensitiveAttrsWithCounts = sensitiveColumns.map(attr => ({
        name: attr,
        uniqueValues: getUniqueValueCount(representation, attr)
    }));

    return (
        <div className="rep-audit-recordset-item">
            <div
                className="rep-audit-recordset-header"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="recordset-title-group">
                    <img src={TableIcon} alt="" className="recordset-icon" />
                    <span className="recordset-name">{recordsetData.recordset_name}</span>
                </div>
                <div className="rep-audit-summary-badge">
                    {numSensitiveAttrs} sensitive attributes / {flaggedGroups} flagged groups / {maxLevel} levels analyzed
                </div>
                <img
                    src={ArrowUpIcon}
                    alt="Toggle"
                    className="toggle-icon"
                    style={{
                        transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)'
                    }}
                />
            </div>

            {isOpen && (
                <div className="rep-audit-recordset-content">
                    <div className="rep-audit-section">
                        <h4 className="rep-audit-section-title">Categorical Sensitive Attributes used in Audit:</h4>
                        <div className="sensitive-attributes-tags">
                            {sensitiveAttrsWithCounts.map((attr, idx) => (
                                <span key={idx} className="sensitive-attr-tag">
                                    {attr.name} ({attr.uniqueValues})
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="rep-audit-section">
                        <h4 className="rep-audit-section-title">
                            Summary:
                        </h4>
                        <h2 className="rep-audit-section-subtitle">{totalSummary.total} derived possible groups across {maxLevel} levels of intersectionality, from which:</h2>
                        <div className="rep-audit-table-wrapper">
                            <table className="rep-audit-summary-table">
                                <thead>
                                    <tr>
                                        <th className="rep-audit-th"></th>
                                        <th className="rep-audit-th rep-audit-th-not-rep"><strong>Not Represented</strong></th>
                                        <th className="rep-audit-th rep-audit-th-under-rep"><strong>Under-Represented</strong></th>
                                        <th className="rep-audit-th rep-audit-th-well-rep"><strong>Well-Represented</strong></th>
                                        <th className="rep-audit-th rep-audit-th-over-rep"><strong>Over-Represented</strong></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(representation.levels || {}).sort().map(level => {
                                        const levelSummary = calculateLevelSummary(representation.levels[level]);

                                        return (
                                            <tr key={level}>
                                                <td className="rep-audit-td rep-audit-td-label"><strong>Level {level}</strong></td>
                                                <td className="rep-audit-td rep-audit-td-data-not-rep">{levelSummary.not_represented}</td>
                                                <td className="rep-audit-td rep-audit-td-data-under-rep">{levelSummary.under_represented}</td>
                                                <td className="rep-audit-td rep-audit-td-data-well-rep">{levelSummary.well_represented}</td>
                                                <td className="rep-audit-td rep-audit-td-data-over-rep">{levelSummary.over_represented}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="rep-audit-total-row">
                                        <td className="rep-audit-td rep-audit-td-label"><strong>Total</strong></td>
                                        <td className="rep-audit-td rep-audit-td-not-rep">
                                            <strong>{totalSummary.not_represented} ({totalSummary.total > 0 ? Math.round((totalSummary.not_represented / totalSummary.total) * 100) : 0}%)</strong>
                                        </td>
                                        <td className="rep-audit-td rep-audit-td-under-rep">
                                            <strong>{totalSummary.under_represented} ({totalSummary.total > 0 ? Math.round((totalSummary.under_represented / totalSummary.total) * 100) : 0}%)</strong>
                                        </td>
                                        <td className="rep-audit-td rep-audit-td-well-rep">
                                            <strong>{totalSummary.well_represented} ({totalSummary.total > 0 ? Math.round((totalSummary.well_represented / totalSummary.total) * 100) : 0}%)</strong>
                                        </td>
                                        <td className="rep-audit-td rep-audit-td-over-rep">
                                            <strong>{totalSummary.over_represented} ({totalSummary.total > 0 ? Math.round((totalSummary.over_represented / totalSummary.total) * 100) : 0}%)</strong>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="rep-audit-section">
                        <h4 className="rep-audit-section-title">Per-Level Breakdown:</h4>
                        <div className="level-breakdown-list">
                            {Object.keys(representation.levels || {}).sort().map(level => (
                                <LevelBreakdown
                                    key={level}
                                    level={level}
                                    levelGroups={representation.levels[level]}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const RepresentationAuditResults = ({ repAudit }) => {
    if (!repAudit || !repAudit.recordsets || repAudit.recordsets.length === 0) {
        return (
            <div className="rep-audit-results">
                <p className="rep-audit-no-results">No audit results available.</p>
            </div>
        );
    }

    return (
        <div className="rep-audit-results">
            {repAudit.recordsets.map((recordset, idx) => (
                <RecordsetAuditResult key={idx} recordsetData={recordset} />
            ))}
        </div>
    );
};

const Dataset = ({ datasetId, initialData, onUpdateName }) => {
    const [status, setStatus] = useState('LOADING_INFO');
    const [metadata, setMetadata] = useState(null);
    const [repAudit, setRepAudit] = useState(null);
    const [summary, setSummary] = useState(null);
    const [showFullDescription, setShowFullDescription] = useState(false);

    const [auditParams, setAuditParams] = useState({
        threshold: '70',
        intersectionality: '2',
        underRatio: '0.5',
        overRatio: '2'
    });

    const storageKey = `fairbite:sensitivityExpanded:${datasetId || "unknown"}`;
    const [expandedMap, setExpandedMap] = useState(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(expandedMap));
        } catch { }
    }, [expandedMap, storageKey]);

    useEffect(() => {
        if (!initialData?.dataset_id) return;

        setStatus("LOADING_INFO");

        let cancelled = false;

        const poll = async () => {
            try {
                const s = await getDatasetStatus(initialData.dataset_id);
                if (cancelled) return;

                if (s.status === "failed") {
                    setStatus("ERROR");
                    alert(s.error || "Dataset processing failed");
                    return;
                }

                if (s.status === "completed") {
                    const report = await getDatasetReport(initialData.dataset_id);
                    if (cancelled) return;

                    setMetadata(report);
                    setStatus("READY");
                    return;
                }

                setTimeout(poll, 1500);
            } catch (e) {
                if (!cancelled) {
                    setStatus("ERROR");
                    alert(e.message);
                }
            }
        };

        poll();
        return () => { cancelled = true; };
    }, [initialData]);

    useEffect(() => {
        if (metadata && onUpdateName) {
            onUpdateName(metadata.dataset_name);
        }
    }, [metadata, onUpdateName]);

    const handleRunAudit = async () => {
        const { threshold, intersectionality, underRatio, overRatio } = auditParams;

        if ([threshold, intersectionality, underRatio, overRatio].some(val => !val || parseFloat(val) < 0)) {
            alert("Please provide valid input for all parameters!");
            return;
        }

        setStatus("LOADING_AUDIT");

        try {
            const params = {
                sensitivity_threshold: parseInt(threshold, 10),
                max_level: parseInt(intersectionality, 10),
                under_ratio: parseFloat(underRatio),
                over_ratio: parseFloat(overRatio),
                min_count: 30,
            };

            const { audit_id } = await createRepresentationAudit(initialData.dataset_id, params);

            const poll = async () => {
                const s = await getRepresentationAuditStatus(audit_id);

                if (s.status === "failed") {
                    setStatus("ERROR");
                    alert(s.error || "Representation audit failed");
                    return;
                }

                if (s.status === "completed") {
                    const r = await getRepresentationAuditResults(audit_id);
                    setRepAudit(r.rep_audit);
                    setSummary(r.summary);
                    setStatus("RESULTS");
                    return;
                }

                setTimeout(poll, 1500);
            };

            poll();
        } catch (e) {
            setStatus("ERROR");
            alert(e.message);
        }
    };

    if (status === 'LOADING_INFO') {
        return (
            <div className="dataset-loading">
                <div className="spinner"></div>
                <p>Loading Dataset...</p>
            </div>
        );
    }

    if (!metadata) return <div>Error loading metadata.</div>;

    const description = metadata.description || "";
    const isLongDesc = description.length > 300;
    const displayedDescription =
        showFullDescription
            ? description
            : description.substring(0, 300) + (isLongDesc ? "..." : "");

    return (
        <div className="dataset-container">
            <style>{`
                .audit-param-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .param-tooltip-wrap {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    outline: none;
                }

                .param-tooltip-icon {
                    width: 18px;
                    height: 18px;
                    min-width: 18px;
                    border-radius: 999px;
                    background: #E9EEF8;
                    color: #2F5AA8;
                    font-size: 12px;
                    font-weight: 700;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: default;
                    border: 1px solid #C9D6F0;
                    line-height: 1;
                }

                .param-tooltip-bubble {
                    position: absolute;
                    left: 50%;
                    bottom: calc(100% + 10px);
                    transform: translateX(-50%);
                    width: 260px;
                    background: #1F2937;
                    color: white;
                    padding: 10px 12px;
                    border-radius: 10px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
                    font-size: 12px;
                    font-weight: 400;
                    line-height: 1.45;
                    z-index: 1000;
                    white-space: normal;
                    text-align: left;
                }

                .param-tooltip-bubble::after {
                    content: "";
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border-width: 7px;
                    border-style: solid;
                    border-color: #1F2937 transparent transparent transparent;
                }
            `}</style>

            <div className="dataset-overview">
                <h2 className="dataset-title">{metadata.dataset_name} Overview</h2>
                <div className="meta-detail">
                    <strong>Source:</strong> <span style={{ color: '#0066cc' }}>{metadata.croissant_url}</span>
                </div>
                <div className="meta-detail">
                    <strong>Description:</strong> {displayedDescription}
                    {isLongDesc && (
                        <span
                            className="meta-link"
                            onClick={() => setShowFullDescription(!showFullDescription)}
                        >
                            {showFullDescription ? " (Show Less)" : " (Show All)"}
                        </span>
                    )}
                </div>
                <div className="meta-detail">
                    <strong>Record Sets:</strong> {metadata.recordsets?.length ?? 0}
                </div>
            </div>

            <AttributeSensitivityAnalysis
                recordsets={metadata.recordsets}
                expandedMap={expandedMap}
                setExpandedMap={setExpandedMap}
            />

            <div className="audit-card">
                <h3 className="section-header">Representation Bias Audit</h3>
                <div className="controls-grid">
                    <div className="input-group">
                        <AuditParamLabel
                            label="Sensitivity Threshold (0 - 100):"
                            tooltip="Only attributes with sensitivity at or above this value are included in the representation audit. Higher values make the audit stricter by focusing on attributes that are more likely to be sensitive."
                        />
                        <input
                            type="number"
                            className="clean-input"
                            value={auditParams.threshold}
                            onChange={(e) =>
                                setAuditParams({ ...auditParams, threshold: e.target.value })
                            }
                        />
                    </div>

                    <div className="input-group">
                        <AuditParamLabel
                            label="Level of intersectionality:"
                            tooltip="This controls how many sensitive attributes can be combined when checking representation. For example, level 1 checks one attribute at a time, while level 2 checks pairwise intersections such as race + sex."
                        />
                        <input
                            type="number"
                            className="clean-input"
                            value={auditParams.intersectionality}
                            onChange={(e) =>
                                setAuditParams({ ...auditParams, intersectionality: e.target.value })
                            }
                        />
                    </div>

                    <div className="input-group">
                        <AuditParamLabel
                            label="Under-representation ratio:"
                            tooltip="Groups with observed share below this ratio relative to their expected equal-share baseline are marked as under-represented. Lower values make the rule more lenient; higher values make it stricter."
                        />
                        <input
                            type="number"
                            step="0.1"
                            className="clean-input"
                            value={auditParams.underRatio}
                            onChange={(e) =>
                                setAuditParams({ ...auditParams, underRatio: e.target.value })
                            }
                        />
                    </div>

                    <div className="input-group">
                        <AuditParamLabel
                            label="Over-representation ratio:"
                            tooltip="Groups with observed share above this ratio relative to their expected equal-share baseline are marked as over-represented. Lower values flag more groups; higher values flag fewer."
                        />
                        <input
                            type="number"
                            step="0.1"
                            className="clean-input"
                            value={auditParams.overRatio}
                            onChange={(e) =>
                                setAuditParams({ ...auditParams, overRatio: e.target.value })
                            }
                        />
                    </div>
                </div>

                <div className="audit-actions">
                    <button className="btn-primary" onClick={handleRunAudit}>
                        Run Audit
                    </button>
                </div>

                {status === 'LOADING_AUDIT' ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                        <p>Running Audit...</p>
                    </div>
                ) : status === 'RESULTS' && repAudit ? (
                    <RepresentationAuditResults repAudit={repAudit} />
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#999', fontStyle: 'italic' }}>
                        <p>No Audit results</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dataset;