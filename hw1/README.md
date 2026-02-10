# kuznetsov_nndl
Repository for nndl workflow and homeworks


You are a senior front-end engineer with strong data analysis skills, focused on building interactive, browser-based tools for data exploration.

I want you to build a fully client-side web application for interactive Exploratory Data Analysis (EDA) of the Titanic dataset from Kaggle (https://www.kaggle.com/competitions/titanic/data). The dataset is provided as two separate CSV files, train.csv (with the Survived target) and test.csv (without the target). The application should allow the user to upload both files, merge them into a single dataset, and add a new column called source to indicate whether each row comes from the train or test split. The app must work entirely in the browser and be deployable on GitHub Pages without any backend.

Your output must consist of exactly two code blocks and nothing else. The first code block must be labeled index.html and contain the full HTML structure, basic CSS styling, and UI layout. The second code block must be labeled app.js and contain all JavaScript logic. The HTML file must include the JavaScript file using <script src="app.js"></script>.

Use only CDN-based libraries. PapaParse should be used for robust CSV parsing (including quoted values and commas), and Chart.js should be used for all visualizations. All data processing, analysis, and rendering must happen client-side.

The HTML layout should include clear sections for data loading, merged data overview, missing value analysis, statistical summaries, visualizations, and data export. There should be file inputs for uploading train.csv and test.csv, buttons to load data, run the EDA, and export results, and simple responsive styling. Include a short deployment note in the UI explaining that the app can be deployed by creating a public GitHub repository, committing index.html and app.js, enabling GitHub Pages on the main branch, and opening the generated URL.

In the JavaScript logic, treat Survived as the target variable (available only for train data). Use Pclass, Sex, Age, SibSp, Parch, Fare, and Embarked as features, and explicitly exclude PassengerId from analysis. Load both CSV files using PapaParse with quotes: true and dynamicTyping: true, merge them into one dataset, and add the source column. Handle invalid input gracefully and notify the user if required files are missing or parsing fails. Add clear comments explaining where the schema could be swapped if the app is reused for a different dataset with a similar train/test split.

The app should provide a dataset overview including shape information and a preview table. It should compute and visualize the percentage of missing values per column using a bar chart. Statistical summaries should include mean, median, and standard deviation for numeric features, as well as value counts for categorical features, with grouping by Survived where the label is available. Visualizations should include bar charts for Sex, Pclass, and Embarked, histograms for Age and Fare, and a correlation heatmap implemented with Chart.js.

Finally, the app should support exporting the merged dataset as a CSV file and exporting a JSON file containing the computed statistical summaries. Export errors should be handled gracefully. The interface should be interactive, driven by buttons and event listeners, and all code should be commented in clear English.
