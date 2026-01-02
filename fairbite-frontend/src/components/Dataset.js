import React, { useState, useEffect } from 'react';
import adultCensusData from '../sen_attr_Adult_Census_Income.json';
import ArrowUpIcon from '../icons/keyboard_arrow_up.svg';
import TableIcon from '../icons/Table.svg';

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

const Dataset = ({ datasetId, initialPath, onUpdateName }) => {
    const [status, setStatus] = useState('LOADING_INFO');
    const [metadata, setMetadata] = useState(null);
    const [showFullDescription, setShowFullDescription] = useState(false);

    const [auditParams, setAuditParams] = useState({
        threshold: '70',
        intersectionality: '2',
        underRatio: '0.5',
        overRatio: '2'
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setMetadata(adultCensusData);
            setStatus('READY');
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (metadata && onUpdateName) {
            onUpdateName(metadata.dataset_name);
        }
    }, [metadata, onUpdateName]);

    const handleRunAudit = () => {
        const { threshold, intersectionality, underRatio, overRatio } = auditParams;
        if ([threshold, intersectionality, underRatio, overRatio].some(val => !val || parseFloat(val) < 0)) {
            alert("Please provide valid input for all parameters!");
            return;
        }

        setStatus('LOADING_AUDIT');
        setTimeout(() => {
            setStatus('RESULTS');
        }, 3000);
    };

    if (status === 'LOADING_INFO') {
        return (
            <div className="dataset-loading" style={{ padding: '50px', textAlign: 'center' }}>
                <div className="spinner"></div>
                <p>Loading Dataset Information...</p>
            </div>
        );
    }

    if (!metadata) return <div>Error loading metadata.</div>;

    const description = metadata.description || "";
    const isLongDesc = description.length > 300;
    const displayedDescription = showFullDescription ? description : description.substring(0, 300) + (isLongDesc ? "..." : "");

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
                    <strong>Record Sets:</strong> {metadata.recordsets.map(r => r.recordset_name).join(', ')}
                </div>
            </div>

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
                            onChange={(e) => setAuditParams({ ...auditParams, threshold: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Level of intersectionality:</label>
                        <input
                            type="number"
                            className="clean-input"
                            value={auditParams.intersectionality}
                            onChange={(e) => setAuditParams({ ...auditParams, intersectionality: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Under-representation ratio:</label>
                        <input
                            type="number"
                            step="0.1"
                            className="clean-input"
                            value={auditParams.underRatio}
                            onChange={(e) => setAuditParams({ ...auditParams, underRatio: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Over-representation ratio:</label>
                        <input
                            type="number"
                            step="0.1"
                            className="clean-input"
                            value={auditParams.overRatio}
                            onChange={(e) => setAuditParams({ ...auditParams, overRatio: e.target.value })}
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
                    <div>
                        {metadata.recordsets.map((rs, index) => (
                            <RecordSetResult key={index} recordSet={rs} />
                        ))}
                    </div>
                </div>
            ) : status !== 'LOADING_AUDIT' && (
                <div style={{ textAlign: 'center', marginTop: '60px', color: '#999', fontStyle: 'italic' }}>
                    <p>No results yet. Run the audit to see analysis.</p>
                </div>
            )}
        </div>
    );
};

export default Dataset;
