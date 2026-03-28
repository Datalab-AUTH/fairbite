import React, { useState } from 'react';

const About = () => {
    const [activeCard, setActiveCard] = useState('problem');

    const cards = [
        {
            key: 'problem',
            eyebrow: 'Why this matters',
            title: 'Bias often starts in the data',
            text: 'In fairness-critical domains such as healthcare, finance, and criminal justice, model behavior is heavily shaped by dataset composition. If meaningful groups are missing or sparsely represented, models may learn patterns that work better for majority populations than for everyone else.',
        },
        {
            key: 'gap',
            eyebrow: 'The current gap',
            title: 'Dataset inspection usually happens too late',
            text: 'Fairness checks often happen after model training, when data problems are harder and more expensive to fix. Manual dataset auditing also requires time, domain knowledge, and repeated schema inspection, which does not scale well.',
        },
        {
            key: 'idea',
            eyebrow: 'Core idea',
            title: 'Use metadata to audit representation early',
            text: 'Structured metadata already describes what dataset fields mean. FairBite uses that information to identify sensitive attributes and inspect subgroup coverage before model development, when corrective actions are still feasible.',
        },
        {
            key: 'system',
            eyebrow: 'What FairBite does',
            title: 'Turns documentation into actionable fairness signals',
            text: 'FairBite combines Croissant metadata parsing, automated sensitive attribute identification, and representation bias auditing into a single interactive workflow that helps users inspect datasets quickly and consistently.',
        },
    ];

    const contributions = [
        {
            id: 'C1',
            title: 'Metadata-driven sensitive attribute identification',
            text: 'Uses structured metadata and language-model reasoning to identify fairness-relevant attributes without manual schema inspection.',
        },
        {
            id: 'C2',
            title: 'Representation audit based on group coverage',
            text: 'Frames representation bias as a subgroup coverage problem and evaluates imbalance across multiple levels of intersectionality.',
        },
        {
            id: 'C3',
            title: 'Unified metadata-based inspection pipeline',
            text: 'Combines metadata parsing, sensitive attribute detection, and bias auditing into one reproducible workflow.',
        },
        {
            id: 'C4',
            title: 'Interactive system for exploratory audit visualization',
            text: 'Delivers an end-to-end interface for exploring results across tables, groups, and intersectionality levels.',
        },
    ];

    const active = cards.find((card) => card.key === activeCard) || cards[0];

    return (
        <div className="tab-content about-container">
            <div className="about-hero">
                <div className="about-hero-copy">
                    <h2 className="about-title">About FairBite</h2>

                    {/* <div className="about-highlight-card">
                        <div className="about-highlight-icon">◎</div>
                        <div>
                            <h3>Fairness starts before the model</h3>
                            <p>
                                Instead of waiting for unfair outcomes to appear during evaluation,
                                FairBite helps users inspect the dataset itself and surface imbalance
                                earlier in the pipeline.
                            </p>
                        </div>
                    </div> */}
                </div>
            </div>

            <div className="about-section">
                <div className="about-section-header">
                    <span className="about-section-kicker">The big picture</span>
                    <h3>What problem is FairBite solving?</h3>
                    <p>
                        Representation bias happens when some groups are under-represented,
                        over-represented, or absent from a dataset. That imbalance can propagate
                        through training and lead to weaker performance for certain populations.
                    </p>
                </div>

                <div className="about-grid two-col">
                    <div className="about-info-card">
                        <h4>Why manual auditing is hard</h4>
                        <ul className="about-bullet-list">
                            <li>Datasets can have dozens or hundreds of attributes.</li>
                            <li>Multiple tables and relationships increase complexity.</li>
                            <li>Sensitive fields often need semantic interpretation, not just name matching.</li>
                            <li>Manual review is slow, inconsistent, and difficult to scale.</li>
                        </ul>
                    </div>

                    <div className="about-info-card">
                        <h4>Why metadata helps</h4>
                        <ul className="about-bullet-list">
                            <li>Metadata gives machine-readable structure.</li>
                            <li>Field descriptions provide semantic context.</li>
                            <li>That context can be processed automatically.</li>
                            <li>This makes early, systematic inspection possible.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="about-section">
                <div className="about-section-header">
                    <span className="about-section-kicker">Interactive summary</span>
                    <h3>How FairBite approaches the problem</h3>
                    <p>
                        Click through the cards below for a short overview of the thesis motivation
                        and system idea.
                    </p>
                </div>

                <div className="about-tab-row">
                    {cards.map((card) => (
                        <button
                            key={card.key}
                            className={`about-tab-card ${activeCard === card.key ? 'active' : ''}`}
                            onClick={() => setActiveCard(card.key)}
                        >
                            <span className="about-tab-eyebrow">{card.eyebrow}</span>
                            <span className="about-tab-title">{card.title}</span>
                        </button>
                    ))}
                </div>

                <div className="about-detail-card">
                    <span className="about-detail-kicker">{active.eyebrow}</span>
                    <h4>{active.title}</h4>
                    <p>{active.text}</p>
                </div>
            </div>

            <div className="about-section">
                <div className="about-section-header">
                    <span className="about-section-kicker">Main contributions</span>
                    <h3>What FairBite contributes</h3>
                </div>

                <div className="about-grid two-col">
                    {contributions.map((item) => (
                        <div className="about-contribution-card" key={item.id}>
                            <span className="about-contribution-number">{item.id}</span>
                            <div>
                                <h4>{item.title}</h4>
                                <p>{item.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="about-footer-note">
                <strong>In one sentence:</strong> FairBite turns dataset metadata into an early-stage
                fairness inspection workflow, helping users detect representation issues before they
                become downstream modeling problems.
            </div>
        </div>
    );
};

export default About;