import React, { useMemo, useRef, useState } from 'react';

import KaggleCroissantImg from '../images/kaggle-croissant.png';
import HuggingFaceCroissantImg from '../images/huggingface-croissant.png';
import HomePasteImg from '../images/home-paste.png';
import SensitivityPanelImg from '../images/sensitivity-panel.png';
import AuditResultsImg from '../images/audit-results.png';

const Help = () => {
    const [activeStep, setActiveStep] = useState(1);
    const [openParam, setOpenParam] = useState('threshold');

    const stepRefs = {
        1: useRef(null),
        2: useRef(null),
        3: useRef(null),
        4: useRef(null),
    };

    const steps = useMemo(() => ([
        {
            id: 1,
            eyebrow: 'Step 1',
            title: 'Select a Croissant dataset',
            summary: 'Find a CSV-based dataset on Kaggle or Hugging Face and copy its Croissant link.',
        },
        {
            id: 2,
            eyebrow: 'Step 2',
            title: 'Start analyzing',
            summary: 'Paste the link into FairBite and let the automatic analysis inspect the dataset.',
        },
        {
            id: 3,
            eyebrow: 'Step 3',
            title: 'Run an audit',
            summary: 'Set the four audit parameters and execute the representation bias audit.',
        },
        {
            id: 4,
            eyebrow: 'Step 4',
            title: 'Explore the results',
            summary: 'Read the summary, inspect the flagged groups, and search or filter specific cases.',
        },
    ]), []);

    const auditParams = [
        {
            key: 'threshold',
            title: 'Sensitivity Threshold',
            text: 'Only attributes with sensitivity at or above this value are included in the audit. Higher thresholds make the audit stricter because they focus on attributes that are more likely to be sensitive.',
        },
        {
            key: 'intersectionality',
            title: 'Level of intersectionality',
            text: 'This controls how many sensitive attributes may be combined when checking representation. For example, level 1 checks one attribute at a time, while level 2 checks pairwise intersections such as race + sex.',
        },
        {
            key: 'underRatio',
            title: 'Under-representation ratio',
            text: 'Groups with observed share below this ratio relative to their expected equal-share baseline are marked as under-represented. Lower values are more lenient, while higher values are stricter.',
        },
        {
            key: 'overRatio',
            title: 'Over-representation ratio',
            text: 'Groups with observed share above this ratio relative to their expected equal-share baseline are marked as over-represented. Lower values flag more groups; higher values flag fewer.',
        },
    ];

    const jumpToStep = (stepId) => {
        setActiveStep(stepId);
        const target = stepRefs[stepId]?.current;
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }
    };

    return (
        <div className="tab-content help-container">
            <div className="help-hero">
                <div className="help-hero-copy">
                    <h2 className="help-title">How to Use FairBite</h2>
                </div>
            </div>

            <div className="help-steps-overview">
                {steps.map((step) => (
                    <button
                        key={step.id}
                        className={`help-step-card ${activeStep === step.id ? 'active' : ''}`}
                        onClick={() => jumpToStep(step.id)}
                    >
                        <span className="help-step-number">{step.id}</span>
                        <div className="help-step-card-copy">
                            <span className="help-step-card-eyebrow">{step.eyebrow}</span>
                            <h3>{step.title}</h3>
                            <p>{step.summary}</p>
                        </div>
                    </button>
                ))}
            </div>

            <section className="help-section" ref={stepRefs[1]}>
                <div className="help-section-header">
                    <span className="help-section-kicker">Step 1</span>
                    <h3>Select a Croissant dataset</h3>
                    <p>
                        Start by choosing a dataset from a repository such as Kaggle or Hugging Face.
                        FairBite works with datasets exposed through a Croissant file, so the only
                        thing you need to collect at this stage is the Croissant URL.
                    </p>
                </div>

                <div className="help-callout">
                    <strong>Note:</strong> Only CSV-based datasets are supported by this version of FairBite.
                </div>

                <div className="help-grid two-col">
                    <article className="help-info-card">
                        <div className="help-info-card-top">
                            <span className="help-badge">Kaggle</span>
                            <h4>How to copy the Croissant link from Kaggle</h4>
                        </div>
                        <ol className="help-ordered-list">
                            <li>Open the dataset page.</li>
                            <li>Click <strong>Download</strong>.</li>
                            <li>Select <strong>Download Via: mlcroissant</strong>.</li>
                            <li>Copy the link shown in the provided code snippet.</li>
                        </ol>
                        <div className="help-image-frame">
                            <img src={KaggleCroissantImg} alt="Kaggle Croissant link instructions" />
                        </div>
                    </article>

                    <article className="help-info-card">
                        <div className="help-info-card-top">
                            <span className="help-badge">Hugging Face</span>
                            <h4>How to copy the Croissant link from Hugging Face</h4>
                        </div>
                        <ol className="help-ordered-list">
                            <li>Open the dataset page.</li>
                            <li>Click <strong>Use this dataset</strong>.</li>
                            <li>Select <strong>Croissant</strong>.</li>
                            <li>Copy the link shown in the code snippet.</li>
                        </ol>
                        <div className="help-image-frame">
                            <img src={HuggingFaceCroissantImg} alt="Hugging Face Croissant link instructions" />
                        </div>
                    </article>
                </div>
            </section>

            <section className="help-section" ref={stepRefs[2]}>
                <div className="help-section-header">
                    <span className="help-section-kicker">Step 2</span>
                    <h3>Start analyzing</h3>
                    <p>
                        Go back to the FairBite home page, paste the Croissant link into the input
                        field, and click <strong>Take a Bite</strong>. This starts the analysis and
                        opens a new tab with the dataset results.
                    </p>
                </div>

                <div className="help-callout">
                    <strong>Note:</strong> Larger datasets or datasets split across multiple files can take longer to process.
                </div>

                <div className="help-grid two-col">
                    <article className="help-info-card">
                        <h4>What happens during loading</h4>
                        <p>
                            FairBite fetches the dataset metadata and begins the automatic attribute
                            sensitivity analysis. The loading time depends on the size of the dataset
                            and the number of files it contains.
                        </p>
                        <ul className="help-bullet-list">
                            <li>Single-file datasets usually load faster.</li>
                            <li>Multi-file datasets can take longer to inspect.</li>
                            <li>The results open in a dedicated dataset tab.</li>
                        </ul>
                        <div className="help-image-frame">
                            <img src={HomePasteImg} alt="Paste Croissant link into FairBite home page" />
                        </div>
                    </article>

                    <article className="help-info-card">
                        <h4>Inspect the attribute sensitivity analysis panel</h4>
                        <p>
                            After loading completes, the first section to inspect is the
                            <strong> Attribute Sensitivity Analysis</strong>. For each file or record
                            set, FairBite ranks columns by a sensitivity score.
                        </p>
                        <p>
                            The sensitivity score is a percentage that estimates how likely an
                            attribute is to be socially sensitive. Examples include race, gender,
                            health, religion, or income.
                        </p>
                        <p>
                            These attributes matter because they are later used to form socially
                            meaningful groups for the audit. Only categorical attributes above the
                            selected sensitivity threshold are carried into the next step, so this
                            panel deserves careful review.
                        </p>
                        <div className="help-image-frame">
                            <img src={SensitivityPanelImg} alt="Attribute Sensitivity Analysis panel" />
                        </div>
                    </article>
                </div>
            </section>

            <section className="help-section" ref={stepRefs[3]}>
                <div className="help-section-header">
                    <span className="help-section-kicker">Step 3</span>
                    <h3>Run an audit</h3>
                    <p>
                        Once you are satisfied with the sensitivity analysis, move to the
                        <strong> Representation Bias Audit</strong> section. Here you choose four key
                        parameters and then run the audit.
                    </p>
                </div>

                <div className="help-interactive-box">
                    <div className="help-interactive-header">
                        <h4>Audit parameters</h4>
                        <p>Click a parameter to expand its explanation.</p>
                    </div>

                    <div className="help-accordion-list">
                        {auditParams.map((param) => {
                            const isOpen = openParam === param.key;
                            return (
                                <div
                                    key={param.key}
                                    className={`help-accordion-item ${isOpen ? 'open' : ''}`}
                                >
                                    <button
                                        className="help-accordion-trigger"
                                        onClick={() => setOpenParam(isOpen ? null : param.key)}
                                    >
                                        <span>{param.title}</span>
                                        <span className="help-accordion-symbol">{isOpen ? '−' : '+'}</span>
                                    </button>

                                    {isOpen && (
                                        <div className="help-accordion-content">
                                            <p>{param.text}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="help-callout soft">
                    After setting the parameters, click <strong>Run Audit</strong>. When the audit
                    finishes, FairBite creates an expandable results section for each file or record
                    set in the dataset.
                </div>
            </section>

            <section className="help-section" ref={stepRefs[4]}>
                <div className="help-section-header">
                    <span className="help-section-kicker">Step 4</span>
                    <h3>Explore the results</h3>
                    <p>
                        The audit results help you judge whether the dataset appears balanced or
                        whether some groups are missing, sparse, or dominant. FairBite organizes the
                        results into three main layers.
                    </p>
                </div>

                <div className="help-grid three-col">
                    <article className="help-info-card compact">
                        <span className="help-badge subtle">1</span>
                        <h4>Preview section</h4>
                        <p>
                            Shows the sensitive categorical attributes used in the audit and, in
                            parentheses, the number of unique values each attribute has.
                        </p>
                    </article>

                    <article className="help-info-card compact">
                        <span className="help-badge subtle">2</span>
                        <h4>Summary section</h4>
                        <p>
                            Gives an overall view of how many derived groups at each level are
                            not-represented, under-represented, well-represented, or
                            over-represented.
                        </p>
                    </article>

                    <article className="help-info-card compact">
                        <span className="help-badge subtle">3</span>
                        <h4>Per-Level Breakdown</h4>
                        <p>
                            Lets you inspect each group in detail: its observed share, expected share,
                            classification, and supporting record count.
                        </p>
                    </article>
                </div>

                <div className="help-grid two-col">
                    <article className="help-info-card">
                        <h4>How to interpret the group categories</h4>
                        <ul className="help-bullet-list">
                            <li>
                                <strong>Not-represented:</strong> groups that do not appear in the
                                dataset.
                            </li>
                            <li>
                                <strong>Under-represented:</strong> groups with limited or inadequate
                                coverage.
                            </li>
                            <li>
                                <strong>Well-represented:</strong> groups whose observed share is close
                                to their expected baseline.
                            </li>
                            <li>
                                <strong>Over-represented:</strong> groups that occupy disproportionately
                                large space in the dataset.
                            </li>
                        </ul>
                    </article>

                    <article className="help-info-card">
                        <h4>Make exploration faster</h4>
                        <p>
                            In the Per-Level Breakdown section, you can combine category filters with
                            the guided search controls to quickly locate specific groups of interest.
                        </p>
                        <p>
                            This makes it easier to inspect intersections such as
                            <strong> race + sex</strong>, compare observed vs expected coverage, and
                            focus on the groups that matter for your analysis.
                        </p>
                    </article>
                </div>

                <div className="help-image-frame wide">
                    <img src={AuditResultsImg} alt="Representation audit results overview" />
                </div>
            </section>
        </div>
    );
};

export default Help;