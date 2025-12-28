import React, { useState } from 'react';
import HomeIcon from '../icons/Home.svg';
import FairBiteIcon from '../icons/FairBiteIcon.svg';
import InfoIcon from '../icons/Info.svg';
import HelpIcon from '../icons/Help_circle.svg';

const Home = ({ openTab }) => {
    const [datasetPath, setDatasetPath] = useState('');

    const handleTakeABite = () => {
        if (!datasetPath.trim()) {
            alert("Please provide a valid path to a Croissant file!");
            return;
        }
        // Logic to open dataset tab is handled by the parent via openTab
        // We pass the path or name. For now, we'll assume the user entered a name or path that becomes the tab name/id
        openTab('dataset', datasetPath);
    };

    return (
        <div className="tab-content home-container">
            <div className="home-centered-content">
                <div className="home-logo-section">
                    <img src={FairBiteIcon} alt="FairBite Logo" className="home-logo-img" />
                    <h1 className="home-title">FairBite</h1>
                </div>

                <div className="search-bar-container">
                    <input
                        type="text"
                        placeholder="Enter Croissant file path"
                        value={datasetPath}
                        onChange={(e) => setDatasetPath(e.target.value)}
                        className="home-search-input"
                    />
                    <button className="home-search-button" onClick={handleTakeABite}>
                        Take a Bite
                    </button>
                </div>

                <div className="info-cards-container">
                    <div className="info-card">
                        <h3>ABOUT</h3>
                        <p>If you wanna learn more about FairBite and its purpose you can click here:</p>
                        <button className="card-button" onClick={() => openTab('about')}>Learn More</button>
                    </div>

                    <div className="info-card">
                        <h3>HELP</h3>
                        <p>If you need assistance using FairBite, please click here:</p>
                        <button className="card-button" onClick={() => openTab('help')}>How to Use</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
