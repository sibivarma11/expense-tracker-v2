import { StyleSheet, View, Text, ScrollView, Dimensions } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface CategoryStat {
  category: string;
  total: number;
  percentage: number;
  count: number;
}

export default function StatsScreen() {
  const db = useSQLiteContext();
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);

  const fetchStats = async () => {
    try {
      const result = await db.getAllAsync<{ category: string; amount: number }>(
        'SELECT category, amount FROM expenses'
      );

      const total = result.reduce((sum, item) => sum + item.amount, 0);
      setTotalExpense(total);

      const categoryMap = result.reduce((acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = { total: 0, count: 0 };
        }
        acc[item.category].total += item.amount;
        acc[item.category].count += 1;
        return acc;
      }, {} as Record<string, { total: number; count: number }>);

      const statsArray: CategoryStat[] = Object.keys(categoryMap).map(cat => ({
        category: cat,
        total: categoryMap[cat].total,
        count: categoryMap[cat].count,
        percentage: total > 0 ? (categoryMap[cat].total / total) * 100 : 0
      })).sort((a, b) => b.total - a.total);

      setStats(statsArray);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

  const getCategoryColor = (index: number) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5'];
    return colors[index % colors.length];
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a2a6c', '#b21f1f', '#fdbb2d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Spending Breakdown</Text>
        <Text style={styles.headerAmount}>₹{totalExpense.toFixed(2)}</Text>
        <Text style={styles.headerSubtitle}>Total Spent</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {stats.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="stats-chart" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No data available yet</Text>
          </View>
        ) : (
          stats.map((item, index) => (
            <View key={item.category} style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={styles.categoryInfo}>
                  <View style={[styles.colorDot, { backgroundColor: getCategoryColor(index) }]} />
                  <Text style={styles.categoryName}>{item.category}</Text>
                  <Text style={styles.transactionCount}>{item.count} transactions</Text>
                </View>
                <Text style={styles.categoryAmount}>₹{item.total.toFixed(2)}</Text>
              </View>

              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${item.percentage}%`,
                      backgroundColor: getCategoryColor(index)
                    }
                  ]}
                />
              </View>
              <Text style={styles.percentageText}>{item.percentage.toFixed(1)}%</Text>
            </View>
          ))
        )}
      </ScrollView>
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
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  headerAmount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 5,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    left: -20, // This might be tricky, let's adjust layout instead
    top: 4,
    display: 'none', // Hiding for now, using a different layout
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  transactionCount: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  categoryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
});
