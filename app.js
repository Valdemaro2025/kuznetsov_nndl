// app.js - Titanic Dataset EDA Tool
// All data processing happens client-side using PapaParse for CSV parsing and Chart.js for visualizations

// ============================================================================
// GLOBAL STATE AND CONFIGURATION
// ============================================================================

// Global state to hold the merged dataset and analysis results
let titanicData = {
    merged: [],           // Combined train + test data with 'source' column
    trainCount: 0,        // Number of rows from train.csv
    testCount: 0,         // Number of rows from test.csv
    columns: [],          // Column names from merged dataset
    columnTypes: {},      // Data type for each column (numeric vs categorical)
    missingValues: {},    // Missing value counts per column
    stats: {},            // Statistical summaries
    charts: {}            // Chart.js chart instances for cleanup
};

// Configuration for features and target variable
// IMPORTANT: To reuse this app with a different dataset, update these arrays
// and ensure the CSV files have matching column names
const FEATURE_COLUMNS = ['Pclass', 'Sex', 'Age', 'SibSp', 'Parch', 'Fare', 'Embarked'];
const TARGET_COLUMN = 'Survived';
const EXCLUDED_COLUMNS = ['PassengerId']; // Columns to exclude from analysis

// ============================================================================
// DOM ELEMENT REFERENCES
// ============================================================================

// File inputs and buttons
const trainFileInput = document.getElementById('train-file');
const testFileInput = document.getElementById('test-file');
const loadDataBtn = document.getElementById('load-data');
const runEDABtn = document.getElementById('run-eda');
const exportDataBtn = document.getElementById('export-data');
const exportStatsBtn = document.getElementById('export-stats');
const statusDiv = document.getElementById('status');

// Display containers
const datasetOverviewDiv = document.getElementById('dataset-overview');
const dataPreviewDiv = document.getElementById('data-preview');
const missingValuesDiv = document.getElementById('missing-values');
const statsContainerDiv = document.getElementById('stats-container');

// ============================================================================
// INITIALIZATION AND EVENT LISTENERS
// ============================================================================

/**
 * Initialize the application by setting up event listeners
 */
function init() {
    // Load and merge datasets when button is clicked
    loadDataBtn.addEventListener('click', loadAndMergeDatasets);
    
    // Run EDA analysis when button is clicked
    runEDABtn.addEventListener('click', runFullEDA);
    
    // Export merged data as CSV
    exportDataBtn.addEventListener('click', exportMergedData);
    
    // Export statistics as JSON
    exportStatsBtn.addEventListener('click', exportStatistics);
    
    // Set initial button states
    updateButtonStates();
    
    console.log('Titanic EDA Tool initialized. Ready to load data.');
}

/**
 * Update button enabled/disabled states based on data availability
 */
function updateButtonStates() {
    const hasData = titanicData.merged.length > 0;
    runEDABtn.disabled = !hasData;
    exportDataBtn.disabled = !hasData;
    exportStatsBtn.disabled = !titanicData.stats || Object.keys(titanicData.stats).length === 0;
}

// ============================================================================
// DATA LOADING AND MERGING
// ============================================================================

/**
 * Load and merge train.csv and test.csv files
 */
async function loadAndMergeDatasets() {
    const trainFile = trainFileInput.files[0];
    const testFile = testFileInput.files[0];
    
    // Validate file inputs
    if (!trainFile || !testFile) {
        showStatus('Please select both train.csv and test.csv files', 'error');
        return;
    }
    
    showStatus('Loading and merging datasets...', 'success');
    
    try {
        // Parse CSV files using PapaParse with robust settings
        const trainData = await parseCSV(trainFile);
        const testData = await parseCSV(testFile);
        
        // Add source column to each dataset
        const trainWithSource = trainData.map(row => ({...row, source: 'train'}));
        const testWithSource = testData.map(row => ({...row, source: 'test'}));
        
        // Merge datasets
        titanicData.merged = [...trainWithSource, ...testWithSource];
        titanicData.trainCount = trainWithSource.length;
        titanicData.testCount = testWithSource.length;
        
        // Extract column names (excluding source for now)
        if (titanicData.merged.length > 0) {
            titanicData.columns = Object.keys(titanicData.merged[0]).filter(col => col !== 'source');
            // Add source back to the end
            titanicData.columns.push('source');
        }
        
        // Determine column types
        determineColumnTypes();
        
        // Update UI
        updateDatasetOverview();
        renderDataPreview();
        updateButtonStates();
        
        showStatus(`Successfully loaded and merged datasets! Train: ${titanicData.trainCount} rows, Test: ${titanicData.testCount} rows, Total: ${titanicData.merged.length} rows`, 'success');
        
    } catch (error) {
        console.error('Error loading datasets:', error);
        showStatus(`Error loading datasets: ${error.message}`, 'error');
    }
}

/**
 * Parse a CSV file using PapaParse
 * @param {File} file - CSV file to parse
 * @returns {Promise<Array>} Parsed data as array of objects
 */
function parseCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,           // First row contains column names
            dynamicTyping: true,    // Convert numeric values to numbers
            skipEmptyLines: true,   // Skip empty lines
            quotes: true,           // Handle quoted values
            complete: (results) => {
                if (results.errors.length > 0) {
                    console.warn('CSV parsing warnings:', results.errors);
                }
                resolve(results.data);
            },
            error: (error) => {
                reject(new Error(`CSV parsing failed: ${error.message}`));
            }
        });
    });
}

/**
 * Determine data types for each column (numeric vs categorical)
 */
function determineColumnTypes() {
    if (titanicData.merged.length === 0) return;
    
    titanicData.columnTypes = {};
    
    // Sample first few rows to determine types
    const sampleSize = Math.min(100, titanicData.merged.length);
    
    titanicData.columns.forEach(column => {
        if (column === 'source') {
            titanicData.columnTypes[column] = 'categorical';
            return;
        }
        
        // Check if column appears to be numeric
        let isNumeric = true;
        let numericCount = 0;
        
        for (let i = 0; i < sampleSize; i++) {
            const value = titanicData.merged[i][column];
            
            if (value === null || value === undefined || value === '') {
                continue; // Skip missing values
            }
            
            if (typeof value !== 'number') {
                isNumeric = false;
                break;
            } else {
                numericCount++;
            }
        }
        
        // If we have at least some numeric values and no non-numeric values, treat as numeric
        if (isNumeric && numericCount > 0) {
            titanicData.columnTypes[column] = 'numeric';
        } else {
            titanicData.columnTypes[column] = 'categorical';
        }
    });
}

// ============================================================================
// UI UPDATES AND RENDERING
// ============================================================================

/**
 * Display status message to user
 * @param {string} message - Status message
 * @param {string} type - Message type: 'success' or 'error'
 */
function showStatus(message, type = 'success') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (statusDiv.textContent === message) {
                statusDiv.style.display = 'none';
            }
        }, 5000);
    }
}

/**
 * Update dataset overview section with shape and column information
 */
function updateDatasetOverview() {
    if (titanicData.merged.length === 0) {
        datasetOverviewDiv.innerHTML = '<p>No data loaded yet.</p>';
        return;
    }
    
    const numericCols = Object.entries(titanicData.columnTypes)
        .filter(([col, type]) => type === 'numeric' && !EXCLUDED_COLUMNS.includes(col))
        .map(([col]) => col);
    
    const categoricalCols = Object.entries(titanicData.columnTypes)
        .filter(([col, type]) => type === 'categorical' && !EXCLUDED_COLUMNS.includes(col))
        .map(([col]) => col);
    
    datasetOverviewDiv.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-title">Dataset Shape</div>
                <div class="stat-content">Rows: ${titanicData.merged.length}
Columns: ${titanicData.columns.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Data Split</div>
                <div class="stat-content">Train: ${titanicData.trainCount} rows
Test: ${titanicData.testCount} rows</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Numeric Features</div>
                <div class="stat-content">${numericCols.join(', ')}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Categorical Features</div>
                <div class="stat-content">${categoricalCols.join(', ')}</div>
            </div>
        </div>
        <h3>Columns Information</h3>
        <div class="columns-grid">
            ${titanicData.columns.map(col => {
                const type = titanicData.columnTypes[col] || 'unknown';
                return `
                    <div class="column-info">
                        <div class="column-name">${col}</div>
                        <div class="column-type">${type} ${EXCLUDED_COLUMNS.includes(col) ? '(excluded)' : ''}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Render a preview table of the first 20 rows of data
 */
function renderDataPreview() {
    if (titanicData.merged.length === 0) {
        dataPreviewDiv.innerHTML = '<p>No data to preview.</p>';
        return;
    }
    
    const previewRows = titanicData.merged.slice(0, 20);
    
    let tableHTML = '<table><thead><tr>';
    
    // Create header row
    titanicData.columns.forEach(col => {
        if (!EXCLUDED_COLUMNS.includes(col)) {
            tableHTML += `<th>${col}</th>`;
        }
    });
    tableHTML += '</tr></thead><tbody>';
    
    // Create data rows
    previewRows.forEach(row => {
        tableHTML += '<tr>';
        titanicData.columns.forEach(col => {
            if (!EXCLUDED_COLUMNS.includes(col)) {
                const value = row[col];
                // Format display
                let displayValue = value;
                if (value === null || value === undefined || value === '') {
                    displayValue = '<span style="color:#e74c3c;font-style:italic">null</span>';
                } else if (typeof value === 'number') {
                    // Round to 2 decimal places for display
                    displayValue = Number.isInteger(value) ? value : value.toFixed(2);
                }
                tableHTML += `<td>${displayValue}</td>`;
            }
        });
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    
    if (titanicData.merged.length > 20) {
        tableHTML += `<p style="text-align:center;padding:10px;">Showing 20 of ${titanicData.merged.length} rows</p>`;
    }
    
    dataPreviewDiv.innerHTML = tableHTML;
}

// ============================================================================
// EDA ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Run full Exploratory Data Analysis
 */
function runFullEDA() {
    if (titanicData.merged.length === 0) {
        showStatus('No data loaded. Please load datasets first.', 'error');
        return;
    }
    
    showStatus('Running EDA analysis...', 'success');
    
    try {
        // Clean up existing charts
        cleanupCharts();
        
        // Calculate missing values
        calculateMissingValues();
        
        // Generate statistical summaries
        calculateStatisticalSummaries();
        
        // Create visualizations
        createVisualizations();
        
        updateButtonStates();
        showStatus('EDA analysis complete!', 'success');
        
    } catch (error) {
        console.error('Error during EDA:', error);
        showStatus(`Error during EDA: ${error.message}`, 'error');
    }
}

/**
 * Clean up existing Chart.js instances
 */
function cleanupCharts() {
    Object.values(titanicData.charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    titanicData.charts = {};
}

/**
 * Calculate missing values for each column
 */
function calculateMissingValues() {
    titanicData.missingValues = {};
    
    titanicData.columns.forEach(column => {
        if (EXCLUDED_COLUMNS.includes(column)) return;
        
        const missingCount = titanicData.merged.filter(row => {
            const value = row[column];
            return value === null || value === undefined || value === '' || 
                  (typeof value === 'number' && isNaN(value));
        }).length;
        
        const percentage = (missingCount / titanicData.merged.length) * 100;
        titanicData.missingValues[column] = {
            count: missingCount,
            percentage: percentage.toFixed(2)
        };
    });
    
    // Update UI
    let missingHTML = '<div class="stats-grid">';
    Object.entries(titanicData.missingValues)
        .sort((a, b) => b[1].percentage - a[1].percentage)
        .forEach(([column, info]) => {
            missingHTML += `
                <div class="stat-card">
                    <div class="stat-title">${column}</div>
                    <div class="stat-content">Missing: ${info.count} rows
Percentage: ${info.percentage}%</div>
                </div>
            `;
        });
    missingHTML += '</div>';
    missingValuesDiv.innerHTML = missingHTML;
    
    // Create missing values chart
    createMissingValuesChart();
}

/**
 * Calculate statistical summaries for numeric and categorical columns
 */
function calculateStatisticalSummaries() {
    titanicData.stats = {};
    
    // Filter columns to analyze (exclude PassengerId)
    const columnsToAnalyze = titanicData.columns.filter(col => 
        !EXCLUDED_COLUMNS.includes(col) && col !== 'source'
    );
    
    columnsToAnalyze.forEach(column => {
        const columnType = titanicData.columnTypes[column];
        const values = titanicData.merged
            .map(row => row[column])
            .filter(val => val !== null && val !== undefined && val !== '');
        
        if (columnType === 'numeric') {
            // Calculate numeric statistics
            const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
            
            if (numericValues.length > 0) {
                const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
                const sorted = [...numericValues].sort((a, b) => a - b);
                const median = sorted[Math.floor(sorted.length / 2)];
                const variance = numericValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numericValues.length;
                const stdDev = Math.sqrt(variance);
                const min = Math.min(...numericValues);
                const max = Math.max(...numericValues);
                
                titanicData.stats[column] = {
                    type: 'numeric',
                    count: numericValues.length,
                    missing: titanicData.merged.length - numericValues.length,
                    mean: mean.toFixed(2),
                    median: median.toFixed(2),
                    stdDev: stdDev.toFixed(2),
                    min: min.toFixed(2),
                    max: max.toFixed(2),
                    q1: sorted[Math.floor(sorted.length * 0.25)].toFixed(2),
                    q3: sorted[Math.floor(sorted.length * 0.75)].toFixed(2)
                };
                
                // Calculate statistics grouped by Survived for train data
                if (column !== TARGET_COLUMN && titanicData.merged[0][TARGET_COLUMN] !== undefined) {
                    const trainData = titanicData.merged.filter(row => row.source === 'train');
                    const survivedValues = trainData
                        .filter(row => typeof row[column] === 'number' && typeof row[TARGET_COLUMN] === 'number')
                        .map(row => ({value: row[column], survived: row[TARGET_COLUMN]}));
                    
                    const survivedMean = survivedValues
                        .filter(v => v.survived === 1)
                        .reduce((sum, v) => sum + v.value, 0) / Math.max(1, survivedValues.filter(v => v.survived === 1).length);
                    
                    const notSurvivedMean = survivedValues
                        .filter(v => v.survived === 0)
                        .reduce((sum, v) => sum + v.value, 0) / Math.max(1, survivedValues.filter(v => v.survived === 0).length);
                    
                    titanicData.stats[column].groupedBySurvived = {
                        survivedMean: survivedMean.toFixed(2),
                        notSurvivedMean: notSurvivedMean.toFixed(2),
                        difference: (survivedMean - notSurvivedMean).toFixed(2)
                    };
                }
            }
        } else {
            // Calculate categorical statistics (value counts)
            const valueCounts = {};
            values.forEach(value => {
                const key = String(value);
                valueCounts[key] = (valueCounts[key] || 0) + 1;
            });
            
            // Sort by count descending
            const sortedCounts = Object.entries(valueCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10); // Top 10 values
            
            titanicData.stats[column] = {
                type: 'categorical',
                count: values.length,
                missing: titanicData.merged.length - values.length,
                uniqueValues: Object.keys(valueCounts).length,
                topValues: sortedCounts
            };
            
            // Calculate value counts grouped by Survived for train data
            if (column !== TARGET_COLUMN && titanicData.merged[0][TARGET_COLUMN] !== undefined) {
                const trainData = titanicData.merged.filter(row => row.source === 'train');
                const groupedCounts = {};
                
                trainData.forEach(row => {
                    if (row[column] !== null && row[column] !== undefined && 
                        row[TARGET_COLUMN] !== null && row[TARGET_COLUMN] !== undefined) {
                        const key = String(row[column]);
                        if (!groupedCounts[key]) {
                            groupedCounts[key] = {survived: 0, notSurvived: 0};
                        }
                        if (row[TARGET_COLUMN] === 1) {
                            groupedCounts[key].survived++;
                        } else {
                            groupedCounts[key].notSurvived++;
                        }
                    }
                });
                
                // Calculate survival rates
                const survivalRates = Object.entries(groupedCounts).map(([value, counts]) => {
                    const total = counts.survived + counts.notSurvived;
                    return {
                        value,
                        survived: counts.survived,
                        notSurvived: counts.notSurvived,
                        survivalRate: total > 0 ? (counts.survived / total * 100).toFixed(1) : '0.0'
                    };
                }).sort((a, b) => b.survivalRate - a.survivalRate);
                
                titanicData.stats[column].groupedBySurvived = survivalRates.slice(0, 10);
            }
        }
    });
    
    // Update UI with statistical summaries
    updateStatisticalSummariesUI();
}

/**
 * Update UI with statistical summaries
 */
function updateStatisticalSummariesUI() {
    if (!titanicData.stats || Object.keys(titanicData.stats).length === 0) {
        statsContainerDiv.innerHTML = '<p>No statistics calculated yet.</p>';
        return;
    }
    
    let statsHTML = '';
    
    // Show key statistics for important columns first
    const importantColumns = [TARGET_COLUMN, ...FEATURE_COLUMNS].filter(col => 
        titanicData.stats[col] && !EXCLUDED_COLUMNS.includes(col)
    );
    
    importantColumns.forEach(column => {
        const stat = titanicData.stats[column];
        
        if (stat.type === 'numeric') {
            statsHTML += `
                <div class="stat-card">
                    <div class="stat-title">${column} (Numeric)</div>
                    <div class="stat-content">Count: ${stat.count}
Mean: ${stat.mean}
Median: ${stat.median}
Std Dev: ${stat.stdDev}
Min/Max: ${stat.min} / ${stat.max}
Missing: ${stat.missing} rows</div>
            `;
            
            if (stat.groupedBySurvived && column !== TARGET_COLUMN) {
                statsHTML += `
                    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #ddd;">
                    <strong>By Survival:</strong>
                    Survived Mean: ${stat.groupedBySurvived.survivedMean}
                    Not Survived Mean: ${stat.groupedBySurvived.notSurvivedMean}
                    Difference: ${stat.groupedBySurvived.difference}</div>
                `;
            }
            
            statsHTML += `</div>`;
            
        } else if (stat.type === 'categorical') {
            let topValuesText = '';
            stat.topValues.forEach(([value, count]) => {
                const percentage = (count / stat.count * 100).toFixed(1);
                topValuesText += `${value}: ${count} (${percentage}%)\n`;
            });
            
            statsHTML += `
                <div class="stat-card">
                    <div class="stat-title">${column} (Categorical)</div>
                    <div class="stat-content">Count: ${stat.count}
Unique Values: ${stat.uniqueValues}
Missing: ${stat.missing} rows
                    
Top Values:
${topValuesText}</div>
            `;
            
            if (stat.groupedBySurvived && column !== TARGET_COLUMN && stat.groupedBySurvived.length > 0) {
                let survivalRatesText = '';
                stat.groupedBySurvived.forEach(item => {
                    survivalRatesText += `${item.value}: ${item.survivalRate}% survived\n`;
                });
                
                statsHTML += `
                    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #ddd;">
                    <strong>Survival Rates:</strong>
${survivalRatesText}</div>
                `;
            }
            
            statsHTML += `</div>`;
        }
    });
    
    statsContainerDiv.innerHTML = statsHTML;
}

// ============================================================================
// VISUALIZATION FUNCTIONS
// ============================================================================

/**
 * Create all visualizations for the EDA
 */
function createVisualizations() {
    createMissingValuesChart();
    createCategoricalCharts();
    createNumericHistograms();
    createCorrelationHeatmap();
}

/**
 * Create bar chart for missing values
 */
function createMissingValuesChart() {
    const ctx = document.getElementById('missing-values-chart').getContext('2d');
    
    const columns = Object.keys(titanicData.missingValues)
        .filter(col => !EXCLUDED_COLUMNS.includes(col))
        .sort((a, b) => titanicData.missingValues[b].percentage - titanicData.missingValues[a].percentage);
    
    const percentages = columns.map(col => parseFloat(titanicData.missingValues[col].percentage));
    
    // Destroy existing chart if it exists
    if (titanicData.charts.missingValues) {
        titanicData.charts.missingValues.destroy();
    }
    
    titanicData.charts.missingValues = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: columns,
            datasets: [{
                label: 'Missing Values (%)',
                data: percentages,
                backgroundColor: percentages.map(p => 
                    p > 20 ? 'rgba(231, 76, 60, 0.7)' : 
                    p > 5 ? 'rgba(241, 196, 15, 0.7)' : 
                    'rgba(46, 204, 113, 0.7)'
                ),
                borderColor: percentages.map(p => 
                    p > 20 ? 'rgb(231, 76, 60)' : 
                    p > 5 ? 'rgb(241, 196, 15)' : 
                    'rgb(46, 204, 113)'
                ),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Missing Values by Column (%)'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const col = columns[context.dataIndex];
                            const missing = titanicData.missingValues[col];
                            return `${col}: ${missing.percentage}% (${missing.count} rows)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Percentage Missing'
                    },
                    max: 100
                },
                x: {
                    title: {
                        display: true,
                        text: 'Column'
                    }
                }
            }
        }
    });
}

/**
 * Create bar charts for categorical features
 */
function createCategoricalCharts() {
    // Chart for Sex distribution
    createBarChart('Sex', 'sex-chart', 'Passenger Gender Distribution');
    
    // Chart for Pclass distribution
    createBarChart('Pclass', 'pclass-chart', 'Passenger Class Distribution');
    
    // Chart for Embarked distribution
    createBarChart('Embarked', 'embarked-chart', 'Embarkation Port Distribution');
}

/**
 * Create a bar chart for a categorical column
 */
function createBarChart(column, canvasId, title) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Get value counts
    const valueCounts = {};
    const trainData = titanicData.merged.filter(row => row.source === 'train');
    
    trainData.forEach(row => {
        if (row[column] !== null && row[column] !== undefined) {
            const key = String(row[column]);
            valueCounts[key] = (valueCounts[key] || 0) + 1;
        }
    });
    
    const labels = Object.keys(valueCounts);
    const counts = Object.values(valueCounts);
    
    // Get survival rates for each category
    const survivalRates = {};
    labels.forEach(label => {
        const categoryRows = trainData.filter(row => String(row[column]) === label && 
                                                   row[TARGET_COLUMN] !== undefined);
        if (categoryRows.length > 0) {
            const survivedCount = categoryRows.filter(row => row[TARGET_COLUMN] === 1).length;
            survivalRates[label] = (survivedCount / categoryRows.length * 100).toFixed(1);
        }
    });
    
    // Destroy existing chart if it exists
    if (titanicData.charts[canvasId]) {
        titanicData.charts[canvasId].destroy();
    }
    
    titanicData.charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Count',
                data: counts,
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgb(52, 152, 219)',
                borderWidth: 1,
                yAxisID: 'y'
            }, {
                label: 'Survival Rate (%)',
                data: labels.map(label => survivalRates[label] || 0),
                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                borderColor: 'rgb(46, 204, 113)',
                borderWidth: 1,
                type: 'line',
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const label = labels[context.dataIndex];
                            const rate = survivalRates[label];
                            if (rate) {
                                return `Survival Rate: ${rate}%`;
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Count'
                    },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Survival Rate (%)'
                    },
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

/**
 * Create histograms for numeric features
 */
function createNumericHistograms() {
    // Histogram for Age
    createHistogram('Age', 'age-chart', 'Age Distribution');
    
    // Histogram for Fare
    createHistogram('Fare', 'fare-chart', 'Fare Distribution');
}

/**
 * Create a histogram for a numeric column
 */
function createHistogram(column, canvasId, title) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Get numeric values from train data
    const trainData = titanicData.merged.filter(row => row.source === 'train');
    const values = trainData
        .map(row => row[column])
        .filter(val => typeof val === 'number' && !isNaN(val));
    
    if (values.length === 0) return;
    
    // Calculate bins using Sturges' formula
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const binCount = Math.ceil(Math.log2(values.length)) + 1;
    const binWidth = range / binCount;
    
    // Create bins
    const bins = Array(binCount).fill(0);
    const binLabels = [];
    
    for (let i = 0; i < binCount; i++) {
        const binStart = min + i * binWidth;
        const binEnd = binStart + binWidth;
        binLabels.push(`${binStart.toFixed(0)}-${binEnd.toFixed(0)}`);
        
        values.forEach(value => {
            if (value >= binStart && (i === binCount - 1 ? value <= binEnd : value < binEnd)) {
                bins[i]++;
            }
        });
    }
    
    // Calculate survival rates per bin
    const survivalRates = [];
    for (let i = 0; i < binCount; i++) {
        const binStart = min + i * binWidth;
        const binEnd = binStart + binWidth;
        
        const binRows = trainData.filter(row => {
            const val = row[column];
            return typeof val === 'number' && !isNaN(val) && 
                   val >= binStart && (i === binCount - 1 ? val <= binEnd : val < binEnd) &&
                   row[TARGET_COLUMN] !== undefined;
        });
        
        if (binRows.length > 0) {
            const survivedCount = binRows.filter(row => row[TARGET_COLUMN] === 1).length;
            survivalRates.push((survivedCount / binRows.length * 100).toFixed(1));
        } else {
            survivalRates.push(0);
        }
    }
    
    // Destroy existing chart if it exists
    if (titanicData.charts[canvasId]) {
        titanicData.charts[canvasId].destroy();
    }
    
    titanicData.charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label: 'Frequency',
                data: bins,
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgb(52, 152, 219)',
                borderWidth: 1,
                yAxisID: 'y'
            }, {
                label: 'Survival Rate (%)',
                data: survivalRates,
                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                borderColor: 'rgb(46, 204, 113)',
                borderWidth: 1,
                type: 'line',
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Frequency'
                    },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Survival Rate (%)'
                    },
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

/**
 * Create correlation heatmap for numeric features
 */
function createCorrelationHeatmap() {
    const ctx = document.getElementById('correlation-chart').getContext('2d');
    
    // Get numeric columns from features
    const numericColumns = FEATURE_COLUMNS.filter(col => 
        titanicData.columnTypes[col] === 'numeric' && 
        titanicData.merged.some(row => typeof row[col] === 'number' && !isNaN(row[col]))
    );
    
    // Include Survived if available
    if (titanicData.columnTypes[TARGET_COLUMN] === 'numeric') {
        numericColumns.push(TARGET_COLUMN);
    }
    
    if (numericColumns.length < 2) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillText('Not enough numeric columns for correlation matrix', 10, 50);
        return;
    }
    
    // Get train data only for correlation (has Survived)
    const trainData = titanicData.merged.filter(row => row.source === 'train');
    
    // Calculate correlation matrix
    const correlations = [];
    const labels = numericColumns;
    
    for (let i = 0; i < numericColumns.length; i++) {
        correlations[i] = [];
        for (let j = 0; j < numericColumns.length; j++) {
            if (i === j) {
                correlations[i][j] = 1;
            } else {
                const col1 = numericColumns[i];
                const col2 = numericColumns[j];
                
                // Get valid pairs
                const pairs = trainData
                    .map(row => ({x: row[col1], y: row[col2]}))
                    .filter(p => typeof p.x === 'number' && !isNaN(p.x) && 
                                 typeof p.y === 'number' && !isNaN(p.y));
                
                if (pairs.length > 0) {
                    // Calculate correlation coefficient
                    const meanX = pairs.reduce((sum, p) => sum + p.x, 0) / pairs.length;
                    const meanY = pairs.reduce((sum, p) => sum + p.y, 0) / pairs.length;
                    
                    const numerator = pairs.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0);
                    const denomX = Math.sqrt(pairs.reduce((sum, p) => sum + Math.pow(p.x - meanX, 2), 0));
                    const denomY = Math.sqrt(pairs.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0));
                    
                    correlations[i][j] = denomX * denomY !== 0 ? numerator / (denomX * denomY) : 0;
                } else {
                    correlations[i][j] = 0;
                }
            }
        }
    }
    
    // Prepare data for matrix chart
    const dataPoints = [];
    for (let i = 0; i < numericColumns.length; i++) {
        for (let j = 0; j < numericColumns.length; j++) {
            dataPoints.push({
                x: i,
                y: j,
                v: correlations[i][j]
            });
        }
    }
    
    // Destroy existing chart if it exists
    if (titanicData.charts.correlation) {
        titanicData.charts.correlation.destroy();
    }
    
    titanicData.charts.correlation = new Chart(ctx, {
        type: 'matrix',
        data: {
            datasets: [{
                label: 'Correlation Matrix',
                data: dataPoints,
                backgroundColor: function(context) {
                    const value = context.dataset.data[context.dataIndex].v;
                    // Red for negative, blue for positive
                    if (value < 0) {
                        const intensity = Math.min(0.7, Math.abs(value));
                        return `rgba(231, 76, 60, ${intensity})`;
                    } else {
                        const intensity = Math.min(0.7, value);
                        return `rgba(52, 152, 219, ${intensity})`;
                    }
                },
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.8)',
                width: ({chart}) => (chart.chartArea.width - 20) / numericColumns.length,
                height: ({chart}) => (chart.chartArea.height - 20) / numericColumns.length
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Correlation Heatmap'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.dataset.data[context.dataIndex];
                            const xLabel = labels[point.x];
                            const yLabel = labels[point.y];
                            return `${xLabel} vs ${yLabel}: ${point.v.toFixed(3)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    labels: labels,
                    offset: true,
                    ticks: {
                        maxRotation: 45
                    },
                    title: {
                        display: true,
                        text: 'Features'
                    }
                },
                y: {
                    type: 'category',
                    labels: labels,
                    offset: true,
                    title: {
                        display: true,
                        text: 'Features'
                    }
                }
            }
        }
    });
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export merged dataset as CSV file
 */
function exportMergedData() {
    if (titanicData.merged.length === 0) {
        showStatus('No data to export', 'error');
        return;
    }
    
    try {
        // Convert to CSV using PapaParse
        const csv = Papa.unparse(titanicData.merged);
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'titanic_merged_data.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showStatus('Merged data exported as titanic_merged_data.csv', 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showStatus(`Error exporting data: ${error.message}`, 'error');
    }
}

/**
 * Export statistical summaries as JSON file
 */
function exportStatistics() {
    if (!titanicData.stats || Object.keys(titanicData.stats).length === 0) {
        showStatus('No statistics to export', 'error');
        return;
    }
    
    try {
        // Create export object with metadata
        const exportData = {
            metadata: {
                dataset: 'Titanic',
                totalRows: titanicData.merged.length,
                trainRows: titanicData.trainCount,
                testRows: titanicData.testCount,
                exportDate: new Date().toISOString()
            },
            missingValues: titanicData.missingValues,
            statistics: titanicData.stats
        };
        
        // Convert to JSON
        const json = JSON.stringify(exportData, null, 2);
        
        // Create download link
        const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'titanic_statistics.json');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showStatus('Statistics exported as titanic_statistics.json', 'success');
        
    } catch (error) {
        console.error('Error exporting statistics:', error);
        showStatus(`Error exporting statistics: ${error.message}`, 'error');
    }
}

// ============================================================================
// APPLICATION START
// ============================================================================

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
