// Dataset.js
import React, { useState, useEffect } from 'react';
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
   Existing Audit Results UI
   ========================= */

const RecordSetResult = ({ recordSet }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="recordset-item">
            <div
                className="recordset-header"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="recordset-title-group">
                    <img src={TableIcon} alt="" className="recordset-icon" />
                    <span className="recordset-name">{recordSet.recordset_name}</span>
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
                <div className="recordset-content">
                    <p className="meta-detail" style={{ marginBottom: '20px' }}>
                        <strong>Description:</strong> {recordSet.recordset_description}
                    </p>
                    <p className="meta-detail">
                        <strong>Sensitive Attributes Found:</strong> {recordSet.results.length}
                    </p>
                    <table className="clean-table">
                        <thead>
                            <tr>
                                <th className="table-th">Key</th>
                                <th className="table-th">Sensitivity</th>
                                <th className="table-th">Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recordSet.results.map((res, idx) => (
                                <tr key={idx}>
                                    <td className="table-td">{res.key}</td>
                                    <td className="table-td">{res.sensitivity}%</td>
                                    <td className="table-td">{res.reason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
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
                <h3 className="section-header">Representation Bias Audit Parameters</h3>
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
            </div>

            {/* Audit Status/Results */}
            {status === 'LOADING_AUDIT' && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p>Running Audit...</p>
                </div>
            )}

            {status === 'RESULTS' ? (
                <div className="results-section">
                    <h3 className="section-header">Audit Results</h3>

                    {/* TODO: Replace this with repAudit + summary UI in next step.
              This still shows the old per-recordset sensitivity table. */}
                    <div>
                        {metadata.recordsets.map((rs, index) => (
                            <RecordSetResult key={index} recordSet={rs} />
                        ))}
                    </div>
                </div>
            ) : status !== 'LOADING_AUDIT' && (
                <div
                    style={{
                        textAlign: 'center',
                        marginTop: '60px',
                        color: '#999',
                        fontStyle: 'italic'
                    }}
                >
                    <p>No results yet. Run the audit to see analysis.</p>
                </div>
            )}
        </div>
    );
};

export default Dataset;
