// app.js
// Titanic EDA Application
// This is a fully client-side exploratory data analysis tool for the Titanic dataset
// Uses PapaParse for CSV parsing and Chart.js for visualizations

// Global variables to store the dataset and analysis results
let mergedData = [];
let trainData = [];
let testData = [];
let dataLoaded = false;
let charts = {}; // Object to store Chart.js instances for easy updates

// Configuration for features and target variable
// To reuse this app with a different dataset, update these configurations:
// 1. targetColumn - the column containing the label to predict
// 2. featureColumns - columns to use as features in analysis
// 3. excludedColumns - columns to exclude from analysis (like IDs)
// 4. categoricalColumns - columns that should be treated as categorical
// 5. numericColumns - columns that should be treated as numeric
const CONFIG = {
    targetColumn: 'Survived',
    featureColumns: ['Pclass', 'Sex', 'Age', 'SibSp', 'Parch', 'Fare', 'Embarked'],
    excludedColumns: ['PassengerId', 'Name', 'Ticket', 'Cabin'],
    categoricalColumns: ['Pclass', 'Sex', 'Embarked', 'SibSp', 'Parch', 'Survived', 'source'],
    numericColumns: ['Age', 'Fare', 'SibSp', 'Parch', 'Pclass']
};

// DOM elements
const trainFileInput = document.getElementById('train-file');
const testFileInput = document.getElementById('test-file');
const loadDataBtn = document.getElementById('load-data-btn');
const runEdaBtn = document.getElementById('run-eda-btn');
const resetBtn = document.getElementById('reset-btn');
const showChartsBtn = document.getElementById('show-charts-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const exportStatsBtn = document.getElementById('export-stats-btn');
const loadingStatus = document.getElementById('loading-status');
const datasetOverview = document.getElementById('dataset-overview');
const columnInfo = document.getElementById('column-info');
const dataPreviewTable = document.getElementById('data-preview-table');
const statisticalSummaries = document.getElementById('statistical-summaries');
const survivalComparison = document.getElementById('survival-comparison');

// Initialize the application
function initApp() {
    // Set up event listeners
    loadDataBtn.addEventListener('click', loadAndMergeData);
    runEdaBtn.addEventListener('click', runFullEDA);
    resetBtn.addEventListener('click', resetAll);
    showChartsBtn.addEventListener('click', generateAllCharts);
    exportCsvBtn.addEventListener('click', exportMergedData);
    exportStatsBtn.addEventListener('click', exportStatistics);
    
    // Update UI state
    updateUIState();
}

// Load and merge the train and test CSV files
function loadAndMergeData() {
    const trainFile = trainFileInput.files[0];
    const testFile = testFileInput.files[0];
    
    // Validate file inputs
    if (!trainFile || !testFile) {
        showStatus('Please select both train.csv and test.csv files', 'error');
        return;
    }
    
    showStatus('Loading and parsing CSV files...', 'warning');
    
    // Parse train.csv
    Papa.parse(trainFile, {
        header: true,
        dynamicTyping: true,
        quotes: true,
        skipEmptyLines: true,
        complete: function(trainResults) {
            if (trainResults.errors.length > 0) {
                showStatus('Error parsing train.csv: ' + trainResults.errors[0].message, 'error');
                return;
            }
            
            trainData = trainResults.data.map(row => ({...row, source: 'train'}));
            showStatus('Train data loaded successfully. Parsing test data...', 'success');
            
            // Parse test.csv
            Papa.parse(testFile, {
                header: true,
                dynamicTyping: true,
                quotes: true,
                skipEmptyLines: true,
                complete: function(testResults) {
                    if (testResults.errors.length > 0) {
                        showStatus('Error parsing test.csv: ' + testResults.errors[0].message, 'error');
                        return;
                    }
                    
                    testData = testResults.data.map(row => ({...row, source: 'test'}));
                    showStatus('Test data loaded successfully. Merging datasets...', 'success');
                    
                    // Merge datasets
                    mergedData = [...trainData, ...testData];
                    dataLoaded = true;
                    
                    // Update UI
                    updateUIState();
                    showStatus('Data loaded and merged successfully! ' + mergedData.length + ' total rows.', 'success');
                    
                    // Show dataset overview
                    displayDatasetOverview();
                    displayColumnInfo();
                    displayDataPreview();
                    
                    // Enable EDA button
                    runEdaBtn.disabled = false;
                }
            });
        }
    });
}

// Run full exploratory data analysis
function runFullEDA() {
    if (!dataLoaded || mergedData.length === 0) {
        showStatus('Please load data first', 'error');
        return;
    }
    
    showStatus('Running Exploratory Data Analysis...', 'warning');
    
    // Analyze missing values
    analyzeMissingValues();
    
    // Generate statistical summaries
    generateStatisticalSummaries();
    
    // Analyze gender impact specifically
    analyzeGenderImpact();
    
    // Enable chart generation and export buttons
    showChartsBtn.disabled = false;
    exportCsvBtn.disabled = false;
    exportStatsBtn.disabled = false;
    
    showStatus('EDA completed successfully!', 'success');
}

// Display dataset overview (shape, columns, etc.)
function displayDatasetOverview() {
    const totalRows = mergedData.length;
    const trainRows = trainData.length;
    const testRows = testData.length;
    const columns = Object.keys(mergedData[0] || {});
    
    // Calculate missing values for Survived column
    const missingSurvived = mergedData.filter(row => row.source === 'test' || row.Survived === null || row.Survived === undefined).length;
    
    datasetOverview.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h4>Dataset Shape</h4>
                <p><strong>${totalRows}</strong> rows × <strong>${columns.length}</strong> columns</p>
            </div>
            <div class="stat-card">
                <h4>Data Split</h4>
                <p><strong>${trainRows}</strong> training rows (${((trainRows/totalRows)*100).toFixed(1)}%)</p>
                <p><strong>${testRows}</strong> test rows (${((testRows/totalRows)*100).toFixed(1)}%)</p>
            </div>
            <div class="stat-card">
                <h4>Target Variable</h4>
                <p><strong>Survived</strong> column</p>
                <p>Available for <strong>${trainRows}</strong> rows (training set only)</p>
                <p>Missing for <strong>${missingSurvived}</strong> rows (test set)</p>
            </div>
            <div class="stat-card">
                <h4>Features for Analysis</h4>
                <p><strong>${CONFIG.featureColumns.length}</strong> features selected</p>
                <p><strong>${CONFIG.excludedColumns.length}</strong> columns excluded</p>
            </div>
        </div>
    `;
}

// Display column information
function displayColumnInfo() {
    if (mergedData.length === 0) return;
    
    const columns = Object.keys(mergedData[0]);
    
    let columnTags = '';
    columns.forEach(col => {
        let tagClass = 'column-tag';
        
        if (col === CONFIG.targetColumn) {
            tagClass += ' target-tag';
        } else if (CONFIG.featureColumns.includes(col)) {
            tagClass += ' feature-tag';
        } else if (CONFIG.excludedColumns.includes(col)) {
            tagClass += ' excluded-tag';
        }
        
        columnTags += `<span class="${tagClass}">${col}</span>`;
    });
    
    columnInfo.innerHTML = `
        <div class="columns-list">
            ${columnTags}
        </div>
        <div style="margin-top: 15px; font-size: 0.9rem;">
            <span style="background-color: #d4edda; padding: 3px 8px; border-radius: 3px; margin-right: 10px;">Green = Target</span>
            <span style="background-color: #f0e6ff; padding: 3px 8px; border-radius: 3px; margin-right: 10px;">Purple = Feature</span>
            <span style="background-color: #f8d7da; padding: 3px 8px; border-radius: 3px;">Red = Excluded</span>
        </div>
    `;
}

// Display a preview of the data in table format
function displayDataPreview() {
    if (mergedData.length === 0) return;
    
    const previewRows = mergedData.slice(0, 10);
    const columns = Object.keys(mergedData[0]);
    
    // Build table header
    let tableHTML = '<thead><tr>';
    columns.forEach(col => {
        if (['PassengerId', 'Survived', 'Pclass', 'Name', 'Sex', 'Age', 'source'].includes(col)) {
            tableHTML += `<th>${col}</th>`;
        }
    });
    tableHTML += '</tr></thead><tbody>';
    
    // Build table rows
    previewRows.forEach((row, index) => {
        tableHTML += '<tr>';
        tableHTML += `<td>${index + 1}</td>`;
        tableHTML += `<td>${row.PassengerId || ''}</td>`;
        tableHTML += `<td>${row.Survived !== null && row.Survived !== undefined ? row.Survived : 'N/A (test)'}</td>`;
        tableHTML += `<td>${row.Pclass || ''}</td>`;
        tableHTML += `<td>${row.Name ? row.Name.substring(0, 20) + (row.Name.length > 20 ? '...' : '') : ''}</td>`;
        tableHTML += `<td>${row.Sex || ''}</td>`;
        tableHTML += `<td>${row.Age || 'N/A'}</td>`;
        tableHTML += `<td>${row.source || ''}</td>`;
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody>';
    dataPreviewTable.innerHTML = tableHTML;
}

// Analyze and visualize missing values
function analyzeMissingValues() {
    if (mergedData.length === 0) return;
    
    const columns = Object.keys(mergedData[0]);
    const missingData = [];
    
    // Calculate missing values for each column
    columns.forEach(col => {
        const missingCount = mergedData.filter(row => {
            const value = row[col];
            return value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value));
        }).length;
        
        const missingPercent = (missingCount / mergedData.length) * 100;
        
        missingData.push({
            column: col,
            missingCount,
            missingPercent
        });
    });
    
    // Sort by missing percentage (descending)
    missingData.sort((a, b) => b.missingPercent - a.missingPercent);
    
    // Destroy existing chart if it exists
    if (charts.missingValues) {
        charts.missingValues.destroy();
    }
    
    // Create bar chart for missing values
    const ctx = document.getElementById('missing-values-chart').getContext('2d');
    charts.missingValues = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: missingData.map(item => item.column),
            datasets: [{
                label: 'Missing Values (%)',
                data: missingData.map(item => item.missingPercent),
                backgroundColor: missingData.map(item => 
                    item.missingPercent > 50 ? 'rgba(231, 76, 60, 0.7)' :
                    item.missingPercent > 20 ? 'rgba(241, 196, 15, 0.7)' :
                    'rgba(52, 152, 219, 0.7)'
                ),
                borderColor: missingData.map(item => 
                    item.missingPercent > 50 ? 'rgba(231, 76, 60, 1)' :
                    item.missingPercent > 20 ? 'rgba(241, 196, 15, 1)' :
                    'rgba(52, 152, 219, 1)'
                ),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Percentage Missing'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const item = missingData[context.dataIndex];
                            return `${item.column}: ${item.missingPercent.toFixed(1)}% (${item.missingCount} rows)`;
                        }
                    }
                }
            }
        }
    });
}

// Generate statistical summaries for numeric and categorical features
function generateStatisticalSummaries() {
    if (mergedData.length === 0) return;
    
    // Filter to only training data for survival analysis
    const trainingData = mergedData.filter(row => row.source === 'train');
    
    // Calculate statistics for numeric columns
    const numericStats = {};
    CONFIG.numericColumns.forEach(col => {
        const values = trainingData
            .map(row => row[col])
            .filter(val => val !== null && val !== undefined && !isNaN(val));
        
        if (values.length > 0) {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const sorted = [...values].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            const stdDev = Math.sqrt(
                values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length
            );
            
            numericStats[col] = { mean, median, stdDev, count: values.length, missing: trainingData.length - values.length };
        }
    });
    
    // Calculate value counts for categorical columns with survival rates
    const categoricalStats = {};
    CONFIG.categoricalColumns.forEach(col => {
        if (col === 'Survived' || col === 'source') return;
        
        const valueCounts = {};
        trainingData.forEach(row => {
            const value = row[col];
            if (value !== null && value !== undefined) {
                const key = String(value);
                if (!valueCounts[key]) {
                    valueCounts[key] = { count: 0, survived: 0 };
                }
                valueCounts[key].count++;
                
                // Count survival if available
                if (row.Survived === 1) {
                    valueCounts[key].survived++;
                }
            }
        });
        
        categoricalStats[col] = valueCounts;
    });
    
    // Display the statistics
    let statsHTML = '<div class="stats-grid">';
    
    // Add numeric stats
    Object.keys(numericStats).forEach(col => {
        const stats = numericStats[col];
        statsHTML += `
            <div class="stat-card">
                <h4>${col} (Numeric)</h4>
                <p>Mean: <strong>${stats.mean.toFixed(2)}</strong></p>
                <p>Median: <strong>${stats.median.toFixed(2)}</strong></p>
                <p>Std Dev: <strong>${stats.stdDev.toFixed(2)}</strong></p>
                <p>Valid Values: <strong>${stats.count}</strong></p>
                <p>Missing: <strong>${stats.missing}</strong> (${((stats.missing/trainingData.length)*100).toFixed(1)}%)</p>
            </div>
        `;
    });
    
    // Add categorical stats with survival rates
    Object.keys(categoricalStats).forEach(col => {
        const valueCounts = categoricalStats[col];
        let valueHTML = '';
        
        Object.keys(valueCounts).forEach(value => {
            const data = valueCounts[value];
            const survivalRate = data.count > 0 ? ((data.survived / data.count) * 100).toFixed(1) : '0';
            valueHTML += `<p>${value}: <strong>${data.count}</strong> (${survivalRate}% survived)</p>`;
        });
        
        statsHTML += `
            <div class="stat-card">
                <h4>${col} (Categorical)</h4>
                ${valueHTML}
            </div>
        `;
    });
    
    // Add overall survival rate
    const totalSurvived = trainingData.filter(row => row.Survived === 1).length;
    const survivalRate = ((totalSurvived / trainingData.length) * 100).toFixed(1);
    
    statsHTML += `
        <div class="stat-card">
            <h4>Survival Overview</h4>
            <p>Total Passengers: <strong>${trainingData.length}</strong></p>
            <p>Survived: <strong>${totalSurvived}</strong> (${survivalRate}%)</p>
            <p>Did Not Survive: <strong>${trainingData.length - totalSurvived}</strong> (${(100 - parseFloat(survivalRate)).toFixed(1)}%)</p>
        </div>
    `;
    
    statsHTML += '</div>';
    statisticalSummaries.innerHTML = statsHTML;
    
    // Store statistics for export
    window.computedStats = { numericStats, categoricalStats };
}

// Analyze gender impact specifically with detailed statistics
function analyzeGenderImpact() {
    if (mergedData.length === 0) return;
    
    const trainingData = mergedData.filter(row => row.source === 'train');
    
    // Calculate gender survival statistics
    const femalePassengers = trainingData.filter(row => row.Sex === 'female');
    const malePassengers = trainingData.filter(row => row.Sex === 'male');
    
    const femaleSurvived = femalePassengers.filter(row => row.Survived === 1).length;
    const maleSurvived = malePassengers.filter(row => row.Survived === 1).length;
    
    const femaleSurvivalRate = ((femaleSurvived / femalePassengers.length) * 100).toFixed(1);
    const maleSurvivalRate = ((maleSurvived / malePassengers.length) * 100).toFixed(1);
    
    // Calculate survival ratio (female:male)
    const survivalRatio = (parseFloat(femaleSurvivalRate) / parseFloat(maleSurvivalRate)).toFixed(1);
    
    // Calculate gender survival by class
    const genderByClass = {};
    [1, 2, 3].forEach(pclass => {
        const classData = trainingData.filter(row => row.Pclass === pclass);
        const femalesInClass = classData.filter(row => row.Sex === 'female');
        const malesInClass = classData.filter(row => row.Sex === 'male');
        
        const femaleSurvivedInClass = femalesInClass.filter(row => row.Survived === 1).length;
        const maleSurvivedInClass = malesInClass.filter(row => row.Survived === 1).length;
        
        const femaleRateInClass = femalesInClass.length > 0 ? 
            ((femaleSurvivedInClass / femalesInClass.length) * 100).toFixed(1) : '0';
        const maleRateInClass = malesInClass.length > 0 ? 
            ((maleSurvivedInClass / malesInClass.length) * 100).toFixed(1) : '0';
        
        genderByClass[pclass] = {
            femaleRate: femaleRateInClass,
            maleRate: maleRateInClass,
            femaleCount: femalesInClass.length,
            maleCount: malesInClass.length
        };
    });
    
    // Update the survival comparison section
    survivalComparison.innerHTML = `
        <div class="comparison-item">
            <h4>Female Survival</h4>
            <div class="survival-rate female-rate">${femaleSurvivalRate}%</div>
            <p>${femaleSurvived} of ${femalePassengers.length} females survived</p>
        </div>
        <div class="comparison-item">
            <h4>Male Survival</h4>
            <div class="survival-rate male-rate">${maleSurvivalRate}%</div>
            <p>${maleSurvived} of ${malePassengers.length} males survived</p>
        </div>
        <div class="comparison-item">
            <h4>Survival Ratio</h4>
            <div class="ratio-display">${survivalRatio}:1</div>
            <p>Women were <strong>${survivalRatio} times</strong> more likely to survive than men</p>
        </div>
    `;
    
    // Add gender-by-class analysis to the insight section
    let classAnalysisHTML = '<div class="evidence-card"><h5>Gender Survival by Passenger Class</h5><ul>';
    
    [1, 2, 3].forEach(pclass => {
        const data = genderByClass[pclass];
        classAnalysisHTML += `
            <li><strong>${pclass === 1 ? 'First' : pclass === 2 ? 'Second' : 'Third'} Class:</strong> 
                Women ${data.femaleRate}% vs Men ${data.maleRate}% 
                (${data.femaleCount} women, ${data.maleCount} men)</li>
        `;
    });
    
    classAnalysisHTML += '</ul></div>';
    
    // Update the evidence section with class analysis
    const insightSection = document.getElementById('gender-analysis');
    const existingCards = insightSection.querySelectorAll('.evidence-card');
    if (existingCards.length >= 4) {
        // Insert after the third evidence card
        existingCards[2].insertAdjacentHTML('afterend', classAnalysisHTML);
    }
    
    // Store gender analysis for export
    window.genderAnalysis = {
        femaleSurvivalRate: parseFloat(femaleSurvivalRate),
        maleSurvivalRate: parseFloat(maleSurvivalRate),
        survivalRatio: parseFloat(survivalRatio),
        femalePassengers: femalePassengers.length,
        malePassengers: malePassengers.length,
        femaleSurvived,
        maleSurvived,
        genderByClass
    };
}

// Generate all visualization charts
function generateAllCharts() {
    if (mergedData.length === 0) return;
    
    // Filter to only training data for charts with survival
    const trainingData = mergedData.filter(row => row.source === 'train');
    
    // 1. Categorical features vs survival
    generateCategoricalChart(trainingData);
    
    // 2. Age distribution
    generateAgeChart(trainingData);
    
    // 3. Fare distribution
    generateFareChart(trainingData);
    
    // 4. Correlation heatmap
    generateCorrelationHeatmap(trainingData);
    
    // 5. Gender survival visualization
    generateGenderSurvivalChart(trainingData);
}

// Generate chart for categorical features vs survival
function generateCategoricalChart(data) {
    // Prepare data for Sex, Pclass, and Embarked
    const categories = ['Sex', 'Pclass', 'Embarked'];
    const labels = [];
    const survivedData = [];
    const notSurvivedData = [];
    
    categories.forEach(category => {
        const uniqueValues = [...new Set(data.map(row => row[category]).filter(val => val !== null && val !== undefined))];
        
        uniqueValues.forEach(value => {
            const filtered = data.filter(row => row[category] === value);
            const survived = filtered.filter(row => row.Survived === 1).length;
            const notSurvived = filtered.length - survived;
            
            labels.push(`${category}: ${value}`);
            survivedData.push(survived);
            notSurvivedData.push(notSurvived);
        });
    });
    
    // Destroy existing chart if it exists
    if (charts.categorical) {
        charts.categorical.destroy();
    }
    
    // Create grouped bar chart
    const ctx = document.getElementById('categorical-chart').getContext('2d');
    charts.categorical = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Survived',
                    data: survivedData,
                    backgroundColor: 'rgba(46, 204, 113, 0.7)',
                    borderColor: 'rgba(39, 174, 96, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Did Not Survive',
                    data: notSurvivedData,
                    backgroundColor: 'rgba(231, 76, 60, 0.7)',
                    borderColor: 'rgba(192, 57, 43, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const datasetIndex = context.datasetIndex;
                            const dataIndex = context.dataIndex;
                            const total = survivedData[dataIndex] + notSurvivedData[dataIndex];
                            const percentage = datasetIndex === 0 
                                ? ((survivedData[dataIndex] / total) * 100).toFixed(1)
                                : ((notSurvivedData[dataIndex] / total) * 100).toFixed(1);
                            return `${percentage}% of this group`;
                        }
                    }
                }
            }
        }
    });
}

// Generate histogram for Age distribution
function generateAgeChart(data) {
    // Filter out missing ages
    const ages = data.map(row => row.Age).filter(age => age !== null && age !== undefined && !isNaN(age));
    
    // Create age bins
    const bins = [0, 10, 20, 30, 40, 50, 60, 70, 80];
    const ageGroups = Array(bins.length - 1).fill(0);
    
    ages.forEach(age => {
        for (let i = 0; i < bins.length - 1; i++) {
            if (age >= bins[i] && age < bins[i + 1]) {
                ageGroups[i]++;
                break;
            } else if (i === bins.length - 2 && age >= bins[i + 1]) {
                ageGroups[i]++;
                break;
            }
        }
    });
    
    // Create labels for bins
    const labels = [];
    for (let i = 0; i < bins.length - 1; i++) {
        labels.push(`${bins[i]}-${bins[i + 1]}`);
    }
    
    // Destroy existing chart if it exists
    if (charts.age) {
        charts.age.destroy();
    }
    
    // Create histogram
    const ctx = document.getElementById('age-chart').getContext('2d');
    charts.age = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Passenger Count',
                data: ageGroups,
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgba(41, 128, 185, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Age Range'
                    }
                }
            }
        }
    });
}

// Generate histogram for Fare distribution
function generateFareChart(data) {
    // Filter out missing fares
    const fares = data.map(row => row.Fare).filter(fare => fare !== null && fare !== undefined && !isNaN(fare));
    
    // Create fare bins (using percentiles for better visualization)
    const sortedFares = [...fares].sort((a, b) => a - b);
    const binCount = 10;
    const binSize = Math.ceil(sortedFares.length / binCount);
    const fareGroups = Array(binCount).fill(0);
    const labels = [];
    
    for (let i = 0; i < binCount; i++) {
        const startIdx = i * binSize;
        const endIdx = Math.min(startIdx + binSize, sortedFares.length);
        
        if (startIdx < sortedFares.length) {
            const minFare = sortedFares[startIdx];
            const maxFare = sortedFares[Math.min(endIdx - 1, sortedFares.length - 1)];
            labels.push(`$${minFare.toFixed(0)}-${maxFare.toFixed(0)}`);
            
            // Count values in this range
            fares.forEach(fare => {
                if (fare >= minFare && (i === binCount - 1 || fare < maxFare)) {
                    fareGroups[i]++;
                }
            });
        }
    }
    
    // Destroy existing chart if it exists
    if (charts.fare) {
        charts.fare.destroy();
    }
    
    // Create histogram
    const ctx = document.getElementById('fare-chart').getContext('2d');
    charts.fare = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Passenger Count',
                data: fareGroups,
                backgroundColor: 'rgba(155, 89, 182, 0.7)',
                borderColor: 'rgba(142, 68, 173, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45
                    },
                    title: {
                        display: true,
                        text: 'Fare Range ($)'
                    }
                }
            }
        }
    });
}

// Generate correlation heatmap for numeric features
function generateCorrelationHeatmap(data) {
    // Select numeric columns for correlation
    const numericCols = CONFIG.numericColumns.filter(col => 
        col !== 'SibSp' && col !== 'Parch' && col !== 'Pclass' // These are better treated as categorical
    );
    
    // Prepare data matrix
    const matrixData = [];
    const labels = [...numericCols, 'Survived'];
    
    // Calculate correlations
    for (let i = 0; i < labels.length; i++) {
        matrixData[i] = [];
        for (let j = 0; j < labels.length; j++) {
            if (i === j) {
                matrixData[i][j] = 1; // Perfect correlation with itself
            } else {
                const col1 = labels[i];
                const col2 = labels[j];
                
                // Extract valid pairs
                const pairs = data
                    .filter(row => 
                        row[col1] !== null && row[col1] !== undefined && !isNaN(row[col1]) &&
                        row[col2] !== null && row[col2] !== undefined && !isNaN(row[col2])
                    )
                    .map(row => ({ x: row[col1], y: row[col2] }));
                
                if (pairs.length > 0) {
                    // Calculate correlation coefficient
                    const sumX = pairs.reduce((sum, pair) => sum + pair.x, 0);
                    const sumY = pairs.reduce((sum, pair) => sum + pair.y, 0);
                    const sumXY = pairs.reduce((sum, pair) => sum + pair.x * pair.y, 0);
                    const sumX2 = pairs.reduce((sum, pair) => sum + pair.x * pair.x, 0);
                    const sumY2 = pairs.reduce((sum, pair) => sum + pair.y * pair.y, 0);
                    
                    const n = pairs.length;
                    const numerator = n * sumXY - sumX * sumY;
                    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
                    
                    matrixData[i][j] = denominator !== 0 ? numerator / denominator : 0;
                } else {
                    matrixData[i][j] = 0;
                }
            }
        }
    }
    
    // Destroy existing chart if it exists
    if (charts.correlation) {
        charts.correlation.destroy();
    }
    
    // Create heatmap
    const ctx = document.getElementById('correlation-chart').getContext('2d');
    charts.correlation = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: labels.map((label, i) => ({
                label: label,
                data: matrixData[i],
                backgroundColor: matrixData[i].map(value => {
                    // Color scale from red (negative) to blue (positive)
                    if (value >= 0) {
                        return `rgba(52, 152, 219, ${Math.abs(value)})`;
                    } else {
                        return `rgba(231, 76, 60, ${Math.abs(value)})`;
                    }
                }),
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    display: false
                },
                y: {
                    ticks: {
                        autoSkip: false
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const rowLabel = context.dataset.label;
                            const colLabel = labels[context.dataIndex];
                            const value = matrixData[labels.indexOf(rowLabel)][context.dataIndex];
                            return `${rowLabel} vs ${colLabel}: ${value.toFixed(3)}`;
                        }
                    }
                },
                legend: {
                    display: false
                }
            }
        }
    });
}

// Generate gender survival comparison chart
function generateGenderSurvivalChart(data) {
    const femalePassengers = data.filter(row => row.Sex === 'female');
    const malePassengers = data.filter(row => row.Sex === 'male');
    
    const femaleSurvived = femalePassengers.filter(row => row.Survived === 1).length;
    const maleSurvived = malePassengers.filter(row => row.Survived === 1).length;
    
    const femaleDied = femalePassengers.length - femaleSurvived;
    const maleDied = malePassengers.length - maleSurvived;
    
    // Create a separate chart for gender survival (in categorical chart)
    // We'll just ensure the categorical chart properly highlights gender
}

// Export merged dataset as CSV
function exportMergedData() {
    if (!dataLoaded || mergedData.length === 0) {
        showStatus('No data to export', 'error');
        return;
    }
    
    try {
        const csv = Papa.unparse(mergedData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'titanic_merged_dataset.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showStatus('Merged dataset exported as CSV', 'success');
    } catch (error) {
        showStatus('Error exporting CSV: ' + error.message, 'error');
    }
}

// Export statistical summaries as JSON
function exportStatistics() {
    if (!window.computedStats) {
        showStatus('No statistics to export. Run EDA first.', 'error');
        return;
    }
    
    try {
        // Include gender analysis in the export
        const exportData = {
            ...window.computedStats,
            genderAnalysis: window.genderAnalysis || {}
        };
        
        const statsJson = JSON.stringify(exportData, null, 2);
        const blob = new Blob([statsJson], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'titanic_statistics.json');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showStatus('Statistics exported as JSON (includes gender analysis)', 'success');
    } catch (error) {
        showStatus('Error exporting JSON: ' + error.message, 'error');
    }
}

// Reset the application to initial state
function resetAll() {
    mergedData = [];
    trainData = [];
    testData = [];
    dataLoaded = false;
    
    // Clear file inputs
    trainFileInput.value = '';
    testFileInput.value = '';
    
    // Destroy all charts
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    charts = {};
    
    // Clear all displayed content
    datasetOverview.innerHTML = '<p>Load data to see overview information here.</p>';
    columnInfo.innerHTML = '<p>Load data to see column details here.</p>';
    dataPreviewTable.innerHTML = '<thead><tr><th>#</th><th>PassengerId</th><th>Survived</th><th>Pclass</th><th>Name</th><th>Sex</th><th>Age</th><th>Source</th></tr></thead><tbody><tr><td colspan="8">No data loaded yet.</td></tr></tbody>';
    statisticalSummaries.innerHTML = '<p>Run EDA to see statistical summaries here.</p>';
    survivalComparison.innerHTML = '<p>Run EDA to see survival comparison data.</p>';
    loadingStatus.innerHTML = '';
    
    // Clear chart canvases
    ['missing-values-chart', 'categorical-chart', 'age-chart', 'fare-chart', 'correlation-chart'].forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });
    
    updateUIState();
    showStatus('Application reset successfully', 'success');
}

// Update UI button states based on data availability
function updateUIState() {
    runEdaBtn.disabled = !dataLoaded;
    showChartsBtn.disabled = !dataLoaded;
    exportCsvBtn.disabled = !dataLoaded;
    exportStatsBtn.disabled = !window.computedStats;
}

// Show status messages to the user
function showStatus(message, type = 'info') {
    loadingStatus.innerHTML = `<div class="status-message ${type}">${message}</div>`;
    
    // Auto-clear success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (loadingStatus.firstChild && loadingStatus.firstChild.classList.contains('success')) {
                loadingStatus.innerHTML = '';
            }
        }, 5000);
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);
