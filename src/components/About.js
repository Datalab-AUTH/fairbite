import React from 'react';

const About = () => {
    return (
        <div className="tab-content about-container">
            <h2>About FairBite</h2>
            <p>
                FairBite is an end-to-end system designed to automate fairness-aware metadata generation and representation-bias auditing
                for datasets. Motivated by the increasing need for transparent, accountable, and reproducible data documentation practices,
                FairBite integrates structured metadata standards, Large Language Models (LLMs), and automated bias assessment into a unified,
                scalable pipeline.
            </p>
             <p>
                At its core, FairBite processes datasets described using the Croissant metadata standard. The system begins by loading and 
                parsing the dataset’s JSON-LD metadata, extracting key dataset information, such as its name, description, and defined 
                RecordSets, and loading the associated data into analysis-ready dataframes.
            </p>
            <p>
                FairBite’s second stage leverages LLMs to identify sensitive attributes within each RecordSet. By grounding the prompts in 
                the dataset’s metadata, the system detects potentially sensitive columns based on their semantics and contextual descriptions. 
                This replaces traditional manual annotation, which is often time-consuming and prone to inconsistency.
            </p>
            <p>
                If sensitive attributes are present, FairBite proceeds to its third stage: representation bias auditing. Here, the system 
                quantifies subgroup representation, records the audit findings, and integrates these results directly back into the dataset’s 
                Croissant metadata. This produces an enriched, machine-readable metadata file that captures both the dataset’s structural 
                information and its fairness-relevant characteristics.
            </p>
            <p>
                By combining structured metadata, automated sensitive-attribute detection, and systematic bias auditing, FairBite offers a 
                transparent and reproducible approach to fairness analysis. The resulting enhanced metadata enables downstream consumers (e.g., 
                researchers, practitioners, and automated tools) to understand, evaluate, and monitor potential sources of bias within datasets.
            </p>
        </div>
    );
};

export default About;
