import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { Card, Title, Paragraph, Chip, Button, List, Divider, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { supabase } from '../../services/supabase';
import { AppContext } from '../../context/AppContext';
import { formatDateWithArabicNumerals } from '../../utils/numberFormatting';

const { width } = Dimensions.get('window');

const AdminAnalytics = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const paperTheme = useTheme();
  const dynamicStyles = createStyles(paperTheme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState({
    overview: {},
    userGrowth: [],
    messageStats: {},
    customerDistribution: [],
    topUsers: [],
    recentActivity: [],
    performanceMetrics: {},
  });

  useEffect(() => {
    if (userId) {
      loadAnalytics();
    }
  }, [userId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Check if user is admin
      const { data: currentUser, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (userError || currentUser.role !== 'admin') {
        Alert.alert('Access Denied', 'Only administrators can access analytics');
        navigation.goBack();
        return;
      }

      // Load all analytics data
      await Promise.all([
        loadOverviewStats(),
        loadUserGrowth(),
        loadMessageStats(),
        loadCustomerDistribution(),
        loadTopUsers(),
        loadRecentActivity(),
        loadPerformanceMetrics(),
      ]);

    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const loadOverviewStats = async () => {
    try {
      // Get total counts
      const [profiles, customers, messages, sessions] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('message_history').select('*', { count: 'exact', head: true }),
        supabase.from('whatsapp_sessions').select('*', { count: 'exact', head: true }),
      ]);

      // Get active users (users with customers)
      const { data: activeUsers } = await supabase
        .from('customers')
        .select('user_id')
        .not('user_id', 'is', null);

      const uniqueActiveUsers = new Set(activeUsers?.map(u => u.user_id) || []).size;

      setAnalytics(prev => ({
        ...prev,
        overview: {
          totalUsers: profiles.count || 0,
          totalCustomers: customers.count || 0,
          totalMessages: messages.count || 0,
          activeSessions: sessions.count || 0,
          activeUsers: uniqueActiveUsers,
          avgCustomersPerUser: customers.count && profiles.count ? (customers.count / profiles.count).toFixed(1) : 0,
        }
      }));
    } catch (error) {
      console.error('Error loading overview stats:', error);
    }
  };

  const loadUserGrowth = async () => {
    try {
      // Get user registration data for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: users } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      // Group by day
      const dailyGrowth = {};
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyGrowth[dateStr] = 0;
      }

      users?.forEach(user => {
        const dateStr = user.created_at.split('T')[0];
        if (dailyGrowth[dateStr] !== undefined) {
          dailyGrowth[dateStr]++;
        }
      });

      const growthData = Object.entries(dailyGrowth)
        .reverse()
        .map(([date, count]) => ({
          date: formatDateWithArabicNumerals(new Date(date), { month: 'short', day: 'numeric' }),
          count
        }));

      setAnalytics(prev => ({
        ...prev,
        userGrowth: growthData
      }));
    } catch (error) {
      console.error('Error loading user growth:', error);
    }
  };

  const loadMessageStats = async () => {
    try {
      // Get message statistics
      const { data: messages } = await supabase
        .from('message_history')
        .select('status, sent_at');

      const stats = {
        total: messages?.length || 0,
        sent: messages?.filter(m => m.status === 'sent').length || 0,
        failed: messages?.filter(m => m.status === 'failed').length || 0,
        pending: messages?.filter(m => m.status === 'pending').length || 0,
      };

      const successRate = stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : 0;

      setAnalytics(prev => ({
        ...prev,
        messageStats: {
          ...stats,
          successRate: parseFloat(successRate)
        }
      }));
    } catch (error) {
      console.error('Error loading message stats:', error);
    }
  };

  const loadCustomerDistribution = async () => {
    try {
      // Get customer distribution by user
      const { data: customers } = await supabase
        .from('customers')
        .select('user_id, profiles(email)')
        .not('user_id', 'is', null);

      const distribution = {};
      customers?.forEach(customer => {
        const userEmail = customer.profiles?.email || 'Unknown';
        distribution[userEmail] = (distribution[userEmail] || 0) + 1;
      });

      const chartData = Object.entries(distribution)
        .map(([email, count], index) => ({
          name: email.split('@')[0],
          count,
          color: `hsl(${index * 60}, 70%, 50%)`,
          legendFontColor: '#7F7F7F',
          legendFontSize: 12,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setAnalytics(prev => ({
        ...prev,
        customerDistribution: chartData
      }));
    } catch (error) {
      console.error('Error loading customer distribution:', error);
    }
  };

  const loadTopUsers = async () => {
    try {
      // Get top users by customer count
      const { data: customers } = await supabase
        .from('customers')
        .select('user_id, profiles(email, full_name, role)')
        .not('user_id', 'is', null);

      const userStats = {};
      customers?.forEach(customer => {
        const userId = customer.user_id;
        if (!userStats[userId]) {
          userStats[userId] = {
            email: customer.profiles?.email || 'Unknown',
            name: customer.profiles?.full_name || 'Unknown',
            role: customer.profiles?.role || 'regular',
            customerCount: 0,
            userId
          };
        }
        userStats[userId].customerCount++;
      });

      const topUsers = Object.values(userStats)
        .sort((a, b) => b.customerCount - a.customerCount)
        .slice(0, 5);

      setAnalytics(prev => ({
        ...prev,
        topUsers
      }));
    } catch (error) {
      console.error('Error loading top users:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      // Get recent activity (new users, messages, etc.)
      const [recentUsers, recentMessages] = await Promise.all([
        supabase
          .from('profiles')
          .select('email, created_at, role')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('message_history')
          .select('phone_number, status, sent_at, profiles(email)')
          .order('sent_at', { ascending: false })
          .limit(5)
      ]);

      const activity = [
        ...(recentUsers.data?.map(user => ({
          type: 'user',
          title: `New ${user.role} user registered`,
          subtitle: user.email,
          time: formatDateWithArabicNumerals(new Date(user.created_at)),
          icon: 'person-add'
        })) || []),
        ...(recentMessages.data?.map(msg => ({
          type: 'message',
          title: `Message ${msg.status}`,
          subtitle: `${msg.profiles?.email || 'Unknown'} → ${msg.phone_number}`,
          time: formatDateWithArabicNumerals(new Date(msg.sent_at)),
          icon: msg.status === 'sent' ? 'checkmark-circle' : 'close-circle'
        })) || [])
      ].sort((a, b) => new Date(b.time) - new Date(a.time))
       .slice(0, 10);

      setAnalytics(prev => ({
        ...prev,
        recentActivity: activity
      }));
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const loadPerformanceMetrics = async () => {
    try {
      // Calculate performance metrics
      const { data: messages } = await supabase
        .from('message_history')
        .select('sent_at, status');

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const todayMessages = messages?.filter(m => 
        new Date(m.sent_at).toDateString() === today.toDateString()
      ) || [];

      const yesterdayMessages = messages?.filter(m => 
        new Date(m.sent_at).toDateString() === yesterday.toDateString()
      ) || [];

      const todaySuccess = todayMessages.filter(m => m.status === 'sent').length;
      const yesterdaySuccess = yesterdayMessages.filter(m => m.status === 'sent').length;

      const growth = yesterdaySuccess > 0 ? 
        ((todaySuccess - yesterdaySuccess) / yesterdaySuccess * 100).toFixed(1) : 
        todaySuccess > 0 ? 100 : 0;

      setAnalytics(prev => ({
        ...prev,
        performanceMetrics: {
          todayMessages: todayMessages.length,
          todaySuccess,
          yesterdayMessages: yesterdayMessages.length,
          yesterdaySuccess,
          growth: parseFloat(growth),
          avgResponseTime: '2.3s', // Mock data
          uptime: '99.8%' // Mock data
        }
      }));
    } catch (error) {
      console.error('Error loading performance metrics:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const renderOverviewCards = () => (
    <View style={dynamicStyles.overviewContainer}>
      <View style={dynamicStyles.cardRow}>
        <Card style={[dynamicStyles.overviewCard, { backgroundColor: '#E3F2FD' }]}>
          <Card.Content>
            <View style={dynamicStyles.cardHeader}>
              <Ionicons name="people" size={24} color="#1976D2" />
              <Text style={dynamicStyles.cardValue}>{analytics.overview.totalUsers}</Text>
            </View>
            <Text style={dynamicStyles.cardLabel}>Total Users</Text>
            <Text style={dynamicStyles.cardSubtext}>{analytics.overview.activeUsers} active</Text>
          </Card.Content>
        </Card>

        <Card style={[dynamicStyles.overviewCard, { backgroundColor: '#F3E5F5' }]}>
          <Card.Content>
            <View style={dynamicStyles.cardHeader}>
              <Ionicons name="person-circle" size={24} color="#7B1FA2" />
              <Text style={dynamicStyles.cardValue}>{analytics.overview.totalCustomers}</Text>
            </View>
            <Text style={dynamicStyles.cardLabel}>Total Customers</Text>
            <Text style={dynamicStyles.cardSubtext}>Avg: {analytics.overview.avgCustomersPerUser}/user</Text>
          </Card.Content>
        </Card>
      </View>

      <View style={dynamicStyles.cardRow}>
        <Card style={[dynamicStyles.overviewCard, { backgroundColor: '#E8F5E8' }]}>
          <Card.Content>
            <View style={dynamicStyles.cardHeader}>
              <Ionicons name="chatbubbles" size={24} color="#388E3C" />
              <Text style={dynamicStyles.cardValue}>{analytics.overview.totalMessages}</Text>
            </View>
            <Text style={dynamicStyles.cardLabel}>Messages Sent</Text>
            <Text style={dynamicStyles.cardSubtext}>{analytics.messageStats.successRate}% success</Text>
          </Card.Content>
        </Card>

        <Card style={[dynamicStyles.overviewCard, { backgroundColor: '#FFF3E0' }]}>
          <Card.Content>
            <View style={dynamicStyles.cardHeader}>
              <Ionicons name="wifi" size={24} color="#F57C00" />
              <Text style={dynamicStyles.cardValue}>{analytics.overview.activeSessions}</Text>
            </View>
            <Text style={dynamicStyles.cardLabel}>Active Sessions</Text>
            <Text style={dynamicStyles.cardSubtext}>WhatsApp connected</Text>
          </Card.Content>
        </Card>
      </View>
    </View>
  );

  const renderUserGrowthChart = () => {
    if (analytics.userGrowth.length === 0) return null;

    const chartData = {
      labels: analytics.userGrowth.map(item => item.date),
      datasets: [{
        data: analytics.userGrowth.map(item => item.count),
        color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
        strokeWidth: 2
      }]
    };

    return (
      <Card style={dynamicStyles.chartCard}>
        <Card.Content>
          <Title style={dynamicStyles.chartTitle}>User Growth (Last 7 Days)</Title>
          <LineChart
            data={chartData}
            width={width - 60}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: {
                borderRadius: 16
              },
              propsForDots: {
                r: '6',
                strokeWidth: '2',
                stroke: '#1976D2'
              }
            }}
            bezier
            style={dynamicStyles.chart}
          />
        </Card.Content>
      </Card>
    );
  };

  const renderMessageStats = () => {
    const { messageStats } = analytics;
    if (!messageStats.total) return null;

    const chartData = [
      {
        name: 'Sent',
        count: messageStats.sent,
        color: '#4CAF50',
        legendFontColor: '#7F7F7F',
        legendFontSize: 12,
      },
      {
        name: 'Failed',
        count: messageStats.failed,
        color: '#F44336',
        legendFontColor: '#7F7F7F',
        legendFontSize: 12,
      },
      {
        name: 'Pending',
        count: messageStats.pending,
        color: '#FF9800',
        legendFontColor: '#7F7F7F',
        legendFontSize: 12,
      }
    ];

    return (
      <Card style={dynamicStyles.chartCard}>
        <Card.Content>
          <Title style={dynamicStyles.chartTitle}>Message Status Distribution</Title>
          <View style={dynamicStyles.statsRow}>
            <View style={dynamicStyles.statItem}>
              <Text style={[dynamicStyles.statValue, { color: '#4CAF50' }]}>{messageStats.sent}</Text>
              <Text style={dynamicStyles.statLabel}>Sent</Text>
            </View>
            <View style={dynamicStyles.statItem}>
              <Text style={[dynamicStyles.statValue, { color: '#F44336' }]}>{messageStats.failed}</Text>
              <Text style={dynamicStyles.statLabel}>Failed</Text>
            </View>
            <View style={dynamicStyles.statItem}>
              <Text style={[dynamicStyles.statValue, { color: '#FF9800' }]}>{messageStats.pending}</Text>
              <Text style={dynamicStyles.statLabel}>Pending</Text>
            </View>
            <View style={dynamicStyles.statItem}>
              <Text style={[dynamicStyles.statValue, { color: '#2196F3' }]}>{messageStats.successRate}%</Text>
              <Text style={dynamicStyles.statLabel}>Success Rate</Text>
            </View>
          </View>
          <PieChart
            data={chartData}
            width={width - 60}
            height={200}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="count"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </Card.Content>
      </Card>
    );
  };

  const renderTopUsers = () => (
    <Card style={dynamicStyles.card}>
      <Card.Content>
        <Title style={dynamicStyles.cardTitle}>Top Users by Customer Count</Title>
        {analytics.topUsers.map((user, index) => (
          <View key={user.userId}>
            <List.Item
              title={user.name}
              description={`${user.email} • ${user.role}`}
              left={() => (
                <View style={dynamicStyles.rankContainer}>
                  <Text style={dynamicStyles.rankText}>{index + 1}</Text>
                </View>
              )}
              right={() => (
                <View style={dynamicStyles.customerCount}>
                  <Text style={dynamicStyles.countText}>{user.customerCount}</Text>
                  <Text style={dynamicStyles.countLabel}>customers</Text>
                </View>
              )}
            />
            {index < analytics.topUsers.length - 1 && <Divider />}
          </View>
        ))}
      </Card.Content>
    </Card>
  );

  const renderRecentActivity = () => (
    <Card style={dynamicStyles.card}>
      <Card.Content>
        <Title style={dynamicStyles.cardTitle}>Recent Activity</Title>
        {analytics.recentActivity.map((activity, index) => (
          <View key={index}>
            <List.Item
              title={activity.title}
              description={activity.subtitle}
              left={() => (
                <Ionicons 
                  name={activity.icon} 
                  size={24} 
                  color={activity.type === 'user' ? '#4CAF50' : '#2196F3'} 
                />
              )}
              right={() => (
                <Text style={dynamicStyles.activityTime}>{activity.time}</Text>
              )}
            />
            {index < analytics.recentActivity.length - 1 && <Divider />}
          </View>
        ))}
      </Card.Content>
    </Card>
  );

  const renderPerformanceMetrics = () => {
    const { performanceMetrics } = analytics;
    
    return (
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <Title style={dynamicStyles.cardTitle}>Performance Metrics</Title>
          <View style={dynamicStyles.metricsGrid}>
            <View style={dynamicStyles.metricItem}>
              <Text style={dynamicStyles.metricValue}>{performanceMetrics.todayMessages}</Text>
              <Text style={dynamicStyles.metricLabel}>Today's Messages</Text>
            </View>
            <View style={dynamicStyles.metricItem}>
              <Text style={[dynamicStyles.metricValue, { color: performanceMetrics.growth >= 0 ? '#4CAF50' : '#F44336' }]}>
                {performanceMetrics.growth >= 0 ? '+' : ''}{performanceMetrics.growth}%
              </Text>
              <Text style={dynamicStyles.metricLabel}>Growth</Text>
            </View>
            <View style={dynamicStyles.metricItem}>
              <Text style={dynamicStyles.metricValue}>{performanceMetrics.avgResponseTime}</Text>
              <Text style={dynamicStyles.metricLabel}>Avg Response</Text>
            </View>
            <View style={dynamicStyles.metricItem}>
              <Text style={dynamicStyles.metricValue}>{performanceMetrics.uptime}</Text>
              <Text style={dynamicStyles.metricLabel}>Uptime</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <ScrollView 
        style={dynamicStyles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>Analytics Dashboard</Text>
          <Text style={dynamicStyles.headerSubtitle}>Real-time insights and performance metrics</Text>
        </View>

        {renderOverviewCards()}
        {renderUserGrowthChart()}
        {renderMessageStats()}
        {renderTopUsers()}
        {renderPerformanceMetrics()}
        {renderRecentActivity()}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  overviewContainer: {
    padding: 15,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  overviewCard: {
    flex: 1,
    marginHorizontal: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  cardLabel: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  chartCard: {
    margin: 15,
  },
  chartTitle: {
    fontSize: 18,
    marginBottom: 15,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  card: {
    margin: 15,
  },
  cardTitle: {
    fontSize: 18,
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  rankContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: theme.colors.onPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  customerCount: {
    alignItems: 'center',
  },
  countText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  countLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  activityTime: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    width: '48%',
    alignItems: 'center',
    padding: 15,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  metricLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
});

export default AdminAnalytics; 