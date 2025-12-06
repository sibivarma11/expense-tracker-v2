import { Ionicons } from '@expo/vector-icons';
import {
    addDays,
    addMonths,
    addWeeks,
    addYears,
    endOfDay,
    endOfMonth,
    endOfWeek,
    endOfYear,
    format,
    startOfDay,
    startOfMonth,
    startOfWeek,
    startOfYear,
    subDays,
    subMonths,
    subWeeks,
    subYears
} from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Period = 'day' | 'week' | 'month' | 'year' | 'all';

interface Expense {
    id: number;
    title: string;
    amount: number;
    date: string;
    category: string;
}

export default function ExportScreen() {
    const db = useSQLiteContext();
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isGenerating, setIsGenerating] = useState(false);

    const getDateRange = (period: Period, date: Date) => {
        switch (period) {
            case 'day':
                return { start: startOfDay(date), end: endOfDay(date) };
            case 'week':
                return { start: startOfWeek(date), end: endOfWeek(date) };
            case 'month':
                return { start: startOfMonth(date), end: endOfMonth(date) };
            case 'year':
                return { start: startOfYear(date), end: endOfYear(date) };
            case 'all':
                return { start: new Date(0), end: new Date(8640000000000000) }; // All time
            default:
                return { start: startOfMonth(date), end: endOfMonth(date) };
        }
    };

    const handlePrev = () => {
        switch (selectedPeriod) {
            case 'day': setCurrentDate(subDays(currentDate, 1)); break;
            case 'week': setCurrentDate(subWeeks(currentDate, 1)); break;
            case 'month': setCurrentDate(subMonths(currentDate, 1)); break;
            case 'year': setCurrentDate(subYears(currentDate, 1)); break;
        }
    };

    const handleNext = () => {
        switch (selectedPeriod) {
            case 'day': setCurrentDate(addDays(currentDate, 1)); break;
            case 'week': setCurrentDate(addWeeks(currentDate, 1)); break;
            case 'month': setCurrentDate(addMonths(currentDate, 1)); break;
            case 'year': setCurrentDate(addYears(currentDate, 1)); break;
        }
    };

    const getPeriodLabel = () => {
        if (selectedPeriod === 'all') return 'All Time';
        const { start, end } = getDateRange(selectedPeriod, currentDate);
        if (selectedPeriod === 'day') return format(start, 'MMMM d, yyyy');
        if (selectedPeriod === 'month') return format(start, 'MMMM yyyy');
        if (selectedPeriod === 'year') return format(start, 'yyyy');
        return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    };

    const fetchExpenses = async () => {
        const { start, end } = getDateRange(selectedPeriod, currentDate);
        const startStr = start.toISOString();
        const endStr = end.toISOString();

        try {
            const result = await db.getAllAsync<Expense>(
                'SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC',
                [startStr, endStr]
            );
            return result;
        } catch (error) {
            console.error('Error fetching expenses:', error);
            return [];
        }
    };

    const generateHtml = (expenses: Expense[], period: Period) => {
        const total = expenses.reduce((sum, item) => sum + item.amount, 0);
        const { start, end } = getDateRange(period, currentDate);
        let dateRangeStr = `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
        if (period === 'all') dateRangeStr = 'All Time';

        const rows = expenses.map(item => `
      <tr>
        <td>${format(new Date(item.date), 'MMM d, yyyy')}</td>
        <td>${item.title}</td>
        <td>${item.category}</td>
        <td style="text-align: right;">₹${item.amount.toFixed(2)}</td>
      </tr>
    `).join('');

        return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            .header { margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .summary { margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; padding: 12px; background-color: #f2f2f2; border-bottom: 1px solid #ddd; }
            td { padding: 12px; border-bottom: 1px solid #eee; }
            .amount { font-weight: bold; color: #e74c3c; }
            .footer { margin-top: 40px; text-align: center; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Expense Report</h1>
            <p>Period: ${period === 'all' ? 'All Time' : period.charAt(0).toUpperCase() + period.slice(1) + ' Wise'}</p>
            <p>${dateRangeStr}</p>
          </div>
          
          <div class="summary">
            <h2>Total Expenses: ₹${total.toFixed(2)}</h2>
            <p>Total Transactions: ${expenses.length}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Category</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="footer">
            Generated by Expense Tracker App on ${format(new Date(), 'PPpp')}
          </div>
        </body>
      </html>
    `;
    };

    const getPDFUri = async () => {
        const expenses = await fetchExpenses();

        if (expenses.length === 0) {
            Alert.alert('No Data', 'No expenses found for the selected period.');
            return null;
        }

        const html = generateHtml(expenses, selectedPeriod);
        const { uri } = await Print.printToFileAsync({ html });
        return uri;
    };

    const handleExport = async () => {
        setIsGenerating(true);
        try {
            const uri = await getPDFUri();
            if (!uri) return;

            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            console.error('Error exporting PDF:', error);
            Alert.alert('Error', 'Failed to export PDF.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#4c669f', '#3b5998', '#192f6a']}
                style={styles.header}
            >
                <Text style={styles.headerTitle}>Export Data</Text>
                <Text style={styles.headerSubtitle}>Generate PDF reports</Text>
            </LinearGradient>

            <View style={styles.content}>
                <Text style={styles.sectionTitle}>Select Period</Text>
                <View style={styles.periodContainer}>
                    {(['day', 'week', 'month', 'year', 'all'] as Period[]).map((period) => (
                        <TouchableOpacity
                            key={period}
                            style={[
                                styles.periodButton,
                                selectedPeriod === period && styles.periodButtonActive
                            ]}
                            onPress={() => setSelectedPeriod(period)}
                        >
                            <Text style={[
                                styles.periodText,
                                selectedPeriod === period && styles.periodTextActive
                            ]}>
                                {period.charAt(0).toUpperCase() + period.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {selectedPeriod !== 'all' && (
                    <View style={styles.dateNavigation}>
                        <TouchableOpacity onPress={handlePrev} style={styles.navButton}>
                            <Ionicons name="chevron-back" size={24} color="#333" />
                        </TouchableOpacity>
                        <Text style={styles.dateLabel}>{getPeriodLabel()}</Text>
                        <TouchableOpacity onPress={handleNext} style={styles.navButton}>
                            <Ionicons name="chevron-forward" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.exportButton}
                        onPress={handleExport}
                        disabled={isGenerating}
                    >
                        <Ionicons name="share-social-outline" size={24} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.exportButtonText}>Export PDF</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 30,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 15,
        marginTop: 10,
    },
    periodContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 30,
    },
    periodButton: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#fff',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    periodButtonActive: {
        backgroundColor: '#0082c8',
        borderColor: '#0082c8',
    },
    periodText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    periodTextActive: {
        color: '#fff',
        fontWeight: 'bold',
    },

    exportButton: {
        backgroundColor: '#0082c8',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 16,
        borderRadius: 16,
        shadowColor: '#0082c8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    exportButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    dateNavigation: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#eee',
    },
    navButton: {
        padding: 10,
    },
    dateLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    downloadButton: {
        backgroundColor: '#0082c8',
    },
    shareButton: {
        backgroundColor: '#4c669f',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
