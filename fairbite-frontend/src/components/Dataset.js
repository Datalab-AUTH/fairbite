// Dataset.js
import React, { useState, useEffect, useRef } from 'react';
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
   Sensitivity UI Helpers
   ========================= */

const sensitivityColor = (s) => {
    const v = Number(s);
    if (v >= 90) return "#47AD33";   // green
    if (v >= 60) return "#ADD633";   // light green
    if (v >= 30) return "#FFD934";   // yellow
    if (v >= 1) return "#FFB234";   // orange
    return "#C34E4E";                // red
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

    // collapsed shows top 10, expanded shows all
    const visible = isExpanded ? sorted : sorted.slice(0, collapsedCount);

    // split visible into two columns (left/right) while keeping order
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
            {/* recordset bar */}
            <div className="sens-recordset-topbar">
                <div className="recordset-title-group">
                    <img src={TableIcon} alt="" className="recordset-icon" />
                    <span className="recordset-name">{recordset.recordset_name}</span>
                </div>
            </div>

            <hr className="sens-recordset-divider" />

            {/* two side-by-side columns always */}
            <div className="sens-two-col-wrap">
                {/* LEFT column */}
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

                {/* RIGHT column */}
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

            {/* View all / View less bottom-right */}
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
   Representation Audit UI Helpers
   ========================= */

// Calculate number of unique values for a sensitive attribute
const getUniqueValueCount = (representation, attribute) => {
    if (!representation?.levels) return 0;
    const uniqueValues = new Set();
    Object.values(representation.levels).forEach(levelGroups => {
        levelGroups.forEach(group => {
            if (group.attributes && group.attributes.includes(attribute) && group.values) {
                const attrIndex = group.attributes.indexOf(attribute);
                // Values array corresponds positionally to attributes array
                if (attrIndex >= 0 && attrIndex < group.values.length) {
                    uniqueValues.add(group.values[attrIndex]);
                }
            }
        });
    });
    return uniqueValues.size;
};

// Count flagged groups (not well_represented)
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

// Calculate summary statistics for a level
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

// Calculate total summary across all levels
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

// Count flagged groups for a specific level
const countFlaggedGroupsForLevel = (levelGroups) => {
    if (!levelGroups || !Array.isArray(levelGroups)) return 0;
    return levelGroups.filter(g => g.category && g.category !== 'well_represented').length;
};

/* =========================
   Representation Audit Results UI
   ========================= */

// Format percentage with up to 4 decimal places
const formatPercentage = (value) => {
    if (value === null || value === undefined) return '-';
    const percentage = value * 100;
    // Show up to 4 decimal places, but remove trailing zeros
    return percentage.toFixed(4).replace(/\.?0+$/, '') + '%';
};

// Get category color and label
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

// Group Card Component
const GroupCard = ({ group }) => {
    const { attributes, values, count, proportion, equal_share, category } = group;
    const categoryStyle = getCategoryStyle(category);
    const isLevel1 = attributes.length === 1;
    
    // Format header: for level 1 just "attribute = value", for level 2+ show all pairs
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
};

// Extract available attributes and their values from level groups
const extractAvailableAttributes = (levelGroups) => {
    const attrMap = {};
    
    levelGroups.forEach(group => {
        if (group.attributes && group.values) {
            group.attributes.forEach((attr, idx) => {
                if (!attrMap[attr]) {
                    attrMap[attr] = new Set();
                }
                if (group.values[idx]) {
                    attrMap[attr].add(group.values[idx]);
                }
            });
        }
    });
    
    // Convert sets to arrays
    const result = {};
    Object.keys(attrMap).forEach(attr => {
        result[attr] = Array.from(attrMap[attr]).sort();
    });
    
    return result;
};

// Parse search query into attribute=value pairs
const parseSearchQuery = (query) => {
    const pairs = [];
    // Updated regex to handle attribute names with dots, hyphens, and values with quotes/special chars
    const regex = /(\w+(?:\.\w+|-)*)\s*=\s*([^,]+?)(?=\s*,\s*\w+\s*=|$)/g;
    let match;
    
    while ((match = regex.exec(query)) !== null) {
        const value = match[2].trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        pairs.push({
            attribute: match[1].trim(),
            value: cleanValue
        });
    }
    
    return pairs;
};

// Check if a group matches search criteria
const groupMatchesSearch = (group, searchPairs) => {
    if (!searchPairs || searchPairs.length === 0) return true;
    
    return searchPairs.every(pair => {
        const attrIndex = group.attributes?.indexOf(pair.attribute);
        if (attrIndex === -1) return false;
        // Compare values as strings, handling special characters
        const groupValue = String(group.values?.[attrIndex] || '');
        const searchValue = String(pair.value || '');
        return groupValue === searchValue;
    });
};

const LevelBreakdown = ({ level, levelGroups, sensitiveColumns }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filterCategory, setFilterCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteOptions, setAutocompleteOptions] = useState([]);
    const [autocompleteType, setAutocompleteType] = useState('attribute'); // 'attribute' or 'value'
    const [selectedAttribute, setSelectedAttribute] = useState(null);
    const searchInputRef = useRef(null);
    const autocompleteRef = useRef(null);
    
    const flaggedCount = countFlaggedGroupsForLevel(levelGroups);
    const isLevel1 = level === '1';
    
    // Close autocomplete when clicking outside
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
    
    // Extract available attributes and values
    const availableAttrs = extractAvailableAttributes(levelGroups || []);
    
    // Filter groups based on category filter
    const getFilteredGroups = () => {
        if (!levelGroups || !Array.isArray(levelGroups)) return [];
        
        let filtered = levelGroups;
        
        // Apply category filter
        if (filterCategory !== 'all') {
            filtered = filtered.filter(g => {
                if (filterCategory === 'not_represented') return g.category === 'not_represented';
                if (filterCategory === 'under_represented') return g.category === 'under_represented';
                if (filterCategory === 'well_represented') return g.category === 'well_represented';
                if (filterCategory === 'over_represented') return g.category === 'over_represented';
                return true;
            });
        }
        
        // Apply search filter (only for level 2+)
        if (!isLevel1 && searchQuery.trim()) {
            const searchPairs = parseSearchQuery(searchQuery);
            filtered = filtered.filter(g => groupMatchesSearch(g, searchPairs));
        }
        
        return filtered;
    };
    
    const filteredGroups = getFilteredGroups();
    
    // Handle search input changes
    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        
        if (!value.trim()) {
            setShowAutocomplete(false);
            return;
        }
        
        // Parse current query to see what's being typed
        const pairs = parseSearchQuery(value);
        const lastCommaIndex = value.lastIndexOf(',');
        const remainingText = lastCommaIndex >= 0 
            ? value.substring(lastCommaIndex + 1).trim()
            : value.trim();
        
        // Determine if we're typing an attribute or value
        if (!remainingText.includes('=')) {
            // Typing an attribute
            setAutocompleteType('attribute');
            setSelectedAttribute(null);
            const usedAttrs = pairs.map(p => p.attribute);
            const available = Object.keys(availableAttrs).filter(attr => {
                return !usedAttrs.includes(attr) && 
                       (remainingText === '' || attr.toLowerCase().includes(remainingText.toLowerCase()));
            });
            setAutocompleteOptions(available);
            setShowAutocomplete(available.length > 0);
        } else {
            // Typing a value
            const attrMatch = remainingText.match(/(\w+(?:\.\w+|-)*)\s*=\s*(.*)/);
            if (attrMatch) {
                const attr = attrMatch[1].trim();
                const valueText = attrMatch[2].trim();
                
                if (availableAttrs[attr]) {
                    setAutocompleteType('value');
                    setSelectedAttribute(attr);
                    const available = availableAttrs[attr].filter(val => {
                        const valStr = String(val).toLowerCase();
                        return valueText === '' || valStr.includes(valueText.toLowerCase());
                    });
                    setAutocompleteOptions(available);
                    setShowAutocomplete(available.length > 0);
                } else {
                    setShowAutocomplete(false);
                }
            } else {
                setShowAutocomplete(false);
            }
        }
    };
    
    const handleAutocompleteSelect = (option) => {
        const pairs = parseSearchQuery(searchQuery);
        const remainingText = searchQuery.substring(searchQuery.lastIndexOf(',') + 1).trim();
        
        if (autocompleteType === 'attribute') {
            // Add attribute and = sign
            const before = searchQuery.substring(0, searchQuery.lastIndexOf(remainingText));
            const newQuery = before + option + ' = ';
            setSearchQuery(newQuery);
            setSelectedAttribute(option);
            setAutocompleteType('value');
            // Show values for this attribute
            setAutocompleteOptions(availableAttrs[option] || []);
            setShowAutocomplete(true);
        } else if (autocompleteType === 'value' && selectedAttribute) {
            // Add value and comma for next pair
            const before = searchQuery.substring(0, searchQuery.lastIndexOf(remainingText));
            const newQuery = before + option + ', ';
            setSearchQuery(newQuery);
            setSelectedAttribute(null);
            setAutocompleteType('attribute');
            setShowAutocomplete(false);
        }
    };
    
    const clearSearch = () => {
        setSearchQuery('');
        setShowAutocomplete(false);
        setSelectedAttribute(null);
    };
    
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
                    {/* Filter Dropdown */}
                    <div className="level-breakdown-controls">
                        <div className="level-filter-group">
                            <label className="level-filter-label">Show:</label>
                            <select 
                                className="level-filter-select"
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                            >
                                <option value="all">All</option>
                                {!isLevel1 && <option value="not_represented">Not-Represented</option>}
                                <option value="under_represented">Under-Represented</option>
                                <option value="well_represented">Well-Represented</option>
                                <option value="over_represented">Over-Represented</option>
                            </select>
                        </div>
                        
                        {/* Search Bar for Level 2+ */}
                        {!isLevel1 && (
                            <div className="level-search-group" ref={autocompleteRef}>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    className="level-search-input"
                                    placeholder="Search groups (e.g. 'race = Black, gender = Female')"
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                    onFocus={() => {
                                        if (!searchQuery) {
                                            setAutocompleteType('attribute');
                                            setAutocompleteOptions(Object.keys(availableAttrs));
                                            setShowAutocomplete(true);
                                        } else {
                                            handleSearchChange({ target: { value: searchQuery } });
                                        }
                                    }}
                                />
                                {searchQuery && (
                                    <button className="level-search-clear" onClick={clearSearch}>
                                        × Clear All
                                    </button>
                                )}
                                {showAutocomplete && autocompleteOptions.length > 0 && (
                                    <div className="autocomplete-dropdown">
                                        {autocompleteOptions.map((option, idx) => (
                                            <div
                                                key={idx}
                                                className="autocomplete-option"
                                                onClick={() => handleAutocompleteSelect(option)}
                                            >
                                                {option}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Groups Grid */}
                    <div className="groups-grid-container">
                        {filteredGroups.length > 0 ? (
                            <div className="groups-grid">
                                {filteredGroups.map((group, idx) => (
                                    <GroupCard key={idx} group={group} />
                                ))}
                            </div>
                        ) : (
                            <div className="no-groups-message">
                                No available results
                            </div>
                        )}
                    </div>
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
    
    // Get unique value counts for each sensitive attribute
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
                    {/* Sensitive Attributes */}
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
                    
                    {/* Summary Table */}
                    <div className="rep-audit-section">
                        <h4 className="rep-audit-section-title">
                            Summary: {totalSummary.total} derived possible groups across {maxLevel} levels of intersectionality, from which:
                        </h4>
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
                                        const levelGroups = representation.levels[level];
                                        const levelSummary = calculateLevelSummary(levelGroups);
                                        const levelTotal = levelSummary.total;
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
                    
                    {/* Per-Level Breakdown */}
                    <div className="rep-audit-section">
                        <h4 className="rep-audit-section-title">Per-Level Breakdown:</h4>
                        <div className="level-breakdown-list">
                            {Object.keys(representation.levels || {}).sort().map(level => (
                                <LevelBreakdown 
                                    key={level} 
                                    level={level} 
                                    levelGroups={representation.levels[level]}
                                    sensitiveColumns={sensitiveColumns}
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

    // Persist View all / View less per dataset tab (survives tab switches)
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

    // Load dataset report (LLM sensitivity)
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

    // Update tab name
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
            {/* Overview Section */}
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

            {/* Attribute Sensitivity Analysis */}
            <AttributeSensitivityAnalysis
                recordsets={metadata.recordsets}
                expandedMap={expandedMap}
                setExpandedMap={setExpandedMap}
            />

            {/* Audit Section */}
            <div className="audit-card">
                <h3 className="section-header">Representation Bias Audit</h3>
                <div className="controls-grid">
                    <div className="input-group">
                        <label className="input-label">Sensitivity Threshold (0 - 100):</label>
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
                        <label className="input-label">Level of intersectionality:</label>
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
                        <label className="input-label">Under-representation ratio:</label>
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
                        <label className="input-label">Over-representation ratio:</label>
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
                    <button className="btn-secondary" disabled>
                        Download Augmented Metadata
                    </button>
                </div>
                
                {/* Show results or no results message */}
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
