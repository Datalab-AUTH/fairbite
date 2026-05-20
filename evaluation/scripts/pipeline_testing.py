from v9_sensitive_characteristics_search import process_single_dataset
from v1_representation_bias_audit import run_representation_audit, save_representation_to_csv

import os
import time
import json


def main():

    start = time.perf_counter()

    # List of dataset metadata URLs (Croissant)
    DATASET_URLS = [
        # "https://www.kaggle.com/datasets/wenruliu/adult-income-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/uciml/adult-census-income/croissant/download",
        # "https://www.kaggle.com/datasets/islombekdavronov/creditscoring-data/croissant/download",
        # "https://www.kaggle.com/datasets/kanakbaghel/hospital-management-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/danofer/law-school-admissions-bar-passage/croissant/download",
        # "https://www.kaggle.com/datasets/danofer/compass/croissant/download",
        # "https://www.kaggle.com/datasets/rohiteng/amazon-sales-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/blueblushed/hospital-dataset-for-practice/croissant/download",
        # "https://www.kaggle.com/datasets/brandao/diabetes/croissant/download",
        # "https://www.kaggle.com/datasets/sadiajavedd/students-academic-performance-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/janiobachmann/bank-marketing-dataset/croissant/download", # couldn't be loaded in dataframe
        # "https://www.kaggle.com/datasets/prince7489/employee-salary-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/ayeshaimran123/social-media-and-mental-health-balance/croissant/download" # Loading failed - not a croissant file
        # "https://www.kaggle.com/datasets/kkanda/communities and crime unnormalized data set/croissant/download", # couldn't be loaded in dataframe
        # "https://www.kaggle.com/datasets/dskagglemt/student-performance-data-set/croissant/download", # couldn't be loaded in dataframe
        # "https://www.kaggle.com/datasets/kundanbedmutha/customer-sentiment-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/zubairdhuddi/shopping-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/tan5577/heart-failure-dataset/croissant/download", # Loading failed - not a croissant file
        # "https://www.kaggle.com/datasets/jockeroika/life-style-data/croissant/download",
        # "https://www.kaggle.com/datasets/yasserh/titanic-dataset/croissant/download", # couldn't be loaded in dataframe
        # "https://www.kaggle.com/datasets/brandmustafa/shopping-trends/croissant/download", # Loading failed - not a croissant file
        # "https://www.kaggle.com/datasets/alamshihab075/mental-health-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/alamshihab075/health-and-lifestyle-data-for-diabetes-prediction/croissant/download",
        # "https://www.kaggle.com/datasets/rehan497/students-social-media-addiction/croissant/download", # Loading failed - not a croissant file
        # "https://www.kaggle.com/datasets/varishabatool/tip-prediction-dataset/croissant/download", # Loading failed - not a croissant file
        # "https://www.kaggle.com/datasets/avineshprabhakaran/loan-eligibility-prediction/croissant/download",
        # "https://www.kaggle.com/datasets/alamshihab075/heart-failure-diagnosis-data-for-machine-learning/croissant/download",
        # "https://www.kaggle.com/datasets/prasad22/healthcare-dataset/croissant/download", # done
        # "https://www.kaggle.com/datasets/kundanbedmutha/exam-score-prediction-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/volodymyrpivoshenko/video-game-sales-dataset/croissant/download"
        # out of scope (3)
        # "https://www.kaggle.com/datasets/nadeemajeedch/employee-performance-and-salary-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/joebeachcapital/30000-spotify-songs/croissant/download"
        # "https://www.kaggle.com/datasets/arshid/iris-flower-dataset/croissant/download"
        # done---------------------------------------
        # "https://www.kaggle.com/datasets/imakash3011/customer-personality-analysis/croissant/download", # couldn't be loaded in dataframe
        # "https://www.kaggle.com/datasets/ajinkyachintawar/sales-and-customer-behaviour-insights/croissant/download",
        # "https://www.kaggle.com/datasets/ranaghulamnabi/shopping-behavior-and-preferences-study/croissant/download",
        # "https://www.kaggle.com/datasets/ziya07/drugpatient-dataset-for-ckd-prediction/croissant/download",
        # "https://www.kaggle.com/datasets/sonalshinde123/social-media-mental-health-indicators-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/emonsharkar/python-learning-and-exam-performance-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/kundanbedmutha/healthcare-symptomsdisease-classification-dataset/croissant/download",
        # # not (many categorical) sensitive attributes
        # "https://www.kaggle.com/datasets/miadul/kidney-function-health-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/volodymyrpivoshenko/video-game-sales-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/kundanbedmutha/healthcare-symptomsdisease-classification-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/suvidyasonawane/student-performance-dataset/croissant/download" // did not save file
        ############### NEW #####################
        # EDUCATION
        # "https://huggingface.co/api/datasets/ErrorER123/student-performance/croissant", +
        # "https://www.kaggle.com/datasets/adilshamim8/personalized-learning-and-adaptive-education-dataset/croissant/download", +
        # "https://www.kaggle.com/datasets/bhavikjikadara/student-study-performance/croissant/download" +
        # "https://www.kaggle.com/datasets/muhammadkhubaibahmad/student-performance-and-clustering-dataset/croissant/download", +
        # "https://www.kaggle.com/datasets/auswalld/student-performance-dataset/croissant/download", +
        # "https://www.kaggle.com/datasets/aryan208/student-habits-and-academic-performance-dataset/croissant/download" +
        #"https://www.kaggle.com/datasets/parthmanjrekar/student-performance-data/croissant/download" +

        # EMPLOYMENT
        # "https://huggingface.co/api/datasets/hugginglearners/data-science-job-salaries/croissant",
        # "https://www.kaggle.com/datasets/zahidmughal2343/employee-data/croissant/download",
        # "https://www.kaggle.com/datasets/smayanj/employee-records-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/carebymanu/employee-dataset-retail/croissant/download",
        # "https://www.kaggle.com/datasets/suneelpatel/hr-attrition-management-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/bhavya5800/hr-analytics-dashboard/croissant/download",
        # "https://www.kaggle.com/datasets/saarib2405/human-resource-dataset/croissant/download"

        # FINANCE
        # "https://huggingface.co/api/datasets/AiresPucrs/german-credit-data/croissant"
        # "https://www.kaggle.com/datasets/ruthgn/bank-marketing-data-set/croissant/download"
        # "https://www.kaggle.com/datasets/taweilo/loan-approval-classification-data/croissant/download"
        "https://www.kaggle.com/datasets/ahmadrafiee/bank-personal-loan/croissant/download",
        "https://www.kaggle.com/datasets/rishikeshkonapure/home-loan-approval/croissant/download"

        # HEALTH
        # "https://www.kaggle.com/datasets/shariful07/student-mental-health/croissant/download",
        # "https://www.kaggle.com/datasets/uom190346a/sleep-health-and-lifestyle-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/bhavikjikadara/mental-health-dataset/croissant/download"
        # "https://www.kaggle.com/datasets/mahdimashayekhi/mental-health/croissant/download",
        # "https://www.kaggle.com/datasets/jaceprater/smokers-health-data/croissant/download"

        # LAW
        # "https://www.kaggle.com/datasets/arsri1/arrest-data-in-los-angeles/croissant/download",
        # "https://www.kaggle.com/datasets/melissamonfared/hate-crimes/croissant/download",
        # "https://www.kaggle.com/datasets/usdpic/execution-database/croissant/download"
        # "https://www.kaggle.com/datasets/kindasomethin/prison-and-prisoners/croissant/download",
        # "https://www.kaggle.com/datasets/willianoliveiragibin/male-homicide-rate-2021/croissant/download",
        # "https://www.kaggle.com/datasets/Connecticut-open-data/connecticut-inmates-awaiting-trial/croissant/download"
        # "https://www.kaggle.com/datasets/econdata/predicting-parole-violators/croissant/download",
        # "https://www.kaggle.com/datasets/mayureshkoli/police-deaths-in-usa-from-1791-to-2022/croissant/download"

        # OUT OF CONTEXT
        # "https://www.kaggle.com/datasets/sarveshchhetri/play-tennis-practice-dataset-for-classification/croissant/download",
        # "https://www.kaggle.com/datasets/akoirala111/lego-sets/croissant/download",
        # "https://www.kaggle.com/datasets/iamsouravbanerjee/computer-games-dataset/croissant/download",
        # "https://www.kaggle.com/datasets/ashishjangra27/geeksforgeeks-articles/croissant/download",
        # "https://www.kaggle.com/datasets/nextmillionaire/programming-languages-trend-over-time/croissant/download",
        # "https://www.kaggle.com/datasets/aryan112345/best-selling-mobile-phones/croissant/download",
        # "https://www.kaggle.com/datasets/shiivvvaam/pc-games/croissant/download"
    ]

    sensitive_dir = "sensitive_attributes_results"
    repbias_dir = "representation_bias_results"

    os.makedirs(sensitive_dir, exist_ok=True)
    os.makedirs(repbias_dir, exist_ok=True)

    for croissant_path in DATASET_URLS:
        print("\n======================================")
        print(f"Processing dataset at URL:\n{croissant_path}")
        print("======================================")

        dataset_report, dataframes = process_single_dataset(croissant_path)

        # Make dataset_name safe for filenames
        dataset_name = str(dataset_report.get("dataset_name", "unknown_dataset"))
        dataset_name = dataset_name.replace(" ", "_").replace("/", "_").replace("\\", "_")

        sen_json_path = os.path.join(
            sensitive_dir,
            f"sen_attr_{dataset_name}_.json"
        )

        with open(sen_json_path, "w", encoding="utf-8") as f:
            json.dump(dataset_report, f, ensure_ascii=False, indent=2)

        dataset_repbias_dir = os.path.join(repbias_dir, dataset_name)
        os.makedirs(dataset_repbias_dir, exist_ok=True)

        rep_audit = run_representation_audit(
            dataset_report=dataset_report,
            dfs=dataframes,
            sensitivity_threshold=70,  # (user-provided)
            max_level=2,  # levels of intersectionality (user-provided)
            min_count=30,  # minimum number of samples a subgroup must contain to be considered adequately represented.
            under_ratio=0.5, # the persentage under the equal-share distribution that classifies under-represented groups.
            over_ratio=2.0,  # the persentage over the equal-share distribution that classifies over-represented groups.
            plots_output_dir="representation_plots",
        )

        rep_csv_path = os.path.join(
            dataset_repbias_dir,
            f"rep_audit_{dataset_name}_.csv"
        )
        save_representation_to_csv(rep_audit, rep_csv_path)

        # (Optional) also save rep audit as JSON
        rep_json_path = os.path.join(
            dataset_repbias_dir,
            f"rep_audit_{dataset_name}_.json"
        )
        with open(rep_json_path, "w", encoding="utf-8") as f:
            json.dump(rep_audit, f, ensure_ascii=False, indent=2, default=str)

    end = time.perf_counter()
    print(f"Execution time: {end - start:.3f} seconds")


if __name__ == "__main__":
    main()