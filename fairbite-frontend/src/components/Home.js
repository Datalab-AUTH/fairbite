import React, { useState } from 'react';
import FairBiteIcon from '../icons/FairBiteIcon.svg';
import { createAudit } from "../api";

const Home = ({ openTab }) => {
    const [datasetPath, setDatasetPath] = useState('');

    const handleTakeABite = async () => {
    if (!datasetPath.trim()) {
        alert("Please provide a valid URL to a Croissant file!");
        return;
    }

    try {
        const payload = {
        croissant_url: datasetPath,
        sensitivity_threshold: 70,
        max_level: 2,
        under_ratio: 0.5,
        over_ratio: 2.0,
        min_count: 30,
        };

        const { audit_id } = await createAudit(payload);

        openTab("dataset", {
        croissant_url: datasetPath,
        audit_id,
        });
    } catch (e) {
        alert("Failed to start audit: " + e.message);
    }
    };

    return (
        <div className="tab-content home-container">
            <div className="home-centered-content">
                <div className="home-logo-section">
                    <img src={FairBiteIcon} alt="FairBite Logo" className="home-logo-img" />
                    <h1 className="home-title">FairBite</h1>
                </div>
                <p className="home-subtitle">Analyze datasets for representation bias with ease.</p>

                <div className="search-section">
                    <div className="search-bar-container">
                        <div className="search-icon-wrapper">
                            {/* Simple file icon placeholder or SVG */}
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                <polyline points="13 2 13 9 20 9"></polyline>
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Paste Croissant file path or browse..."
                            value={datasetPath}
                            onChange={(e) => setDatasetPath(e.target.value)}
                            className="home-search-input"
                        />
                        <button className="home-search-button" onClick={handleTakeABite}>
                            Take a Bite
                        </button>
                    </div>
                    <p className="search-helper-text">We'll analyze it locally and generate a fairness report.</p>
                </div>

                <div className="info-cards-container">
                    <div className="info-card">
                        <div className="card-icon-circle orange">
                            <span className="icon-text">i</span>
                        </div>
                        <h3>Learn More</h3>
                        <p>Learn what FairBite checks and why it matters.</p>
                        <button className="card-button primary" onClick={() => openTab('about')}>Learn More</button>
                    </div>

                    <div className="info-card">
                        <div className="card-icon-circle orange">
                            <span className="icon-text">?</span>
                        </div>
                        <h3>How to Use</h3>
                        <p>Step-by-step guide to run your first evaluation.</p>
                        <button className="card-button primary" onClick={() => openTab('help')}>How to Use</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
