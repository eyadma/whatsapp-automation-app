import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  TouchableOpacity,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  ProgressBar,
  List,
  Divider,
  FAB,
  IconButton,
  DataTable,
  useTheme,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../context/AppContext';
import { enhancedSessionAPI } from '../services/enhancedSessionAPI';

const { width, height } = Dimensions.get('window');

const SessionAnalyticsScreen = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const paperTheme = useTheme();
  const dynamicStyles = createStyles(paperTheme);
  const [analytics, setAnalytics] = useState({
    overview: {},
    sessions: [],
    metrics: [],
    trends: [],
    insights: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [selectedSession, setSelectedSession] = useState('all');
  const [showInsights, setShowInsights] = useState(false);

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const scaleAnim = new Animated.Value(0.8);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    if (userId) {
      loadAnalytics();
      startAnimations();
      startPulseAnimation();
    }
  }, [userId, selectedPeriod, selectedSession]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Get session statistics
      const statsResponse = await enhancedSessionAPI.getSessionStatistics(userId);
      if (!statsResponse.success) throw new Error(statsResponse.error);

      // Get metrics for selected period
      const metricsResponse = await enhancedSessionAPI.getSessionMetrics(
        selectedSession === 'all' ? null : selectedSession,
        userId,
        getStartDate(selectedPeriod),
        new Date().toISOString().split('T')[0]
      );

      // Generate insights
      const insights = generateInsights(statsResponse.statistics, metricsResponse.metrics || []);

      // Generate trends
      const trends = generateTrends(metricsResponse.metrics || []);

      setAnalytics({
        overview: statsResponse.statistics,
        sessions: statsResponse.statistics.sessions || [],
        metrics: metricsResponse.metrics || [],
        trends,
        insights
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = (period) => {
    const now = new Date();
    switch (period) {
      case '1d':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
  };

  const generateInsights = (stats, metrics) => {
    const insights = [];

    // Session performance insights
    if (stats.connectedSessions > 0) {
      const avgMessagesPerSession = stats.totalMessagesToday / stats.connectedSessions;
      if (avgMessagesPerSession > 50) {
        insights.push({
          type: 'success',
          icon: 'trending-up',
          title: 'High Activity',
          description: `Your sessions are averaging ${Math.round(avgMessagesPerSession)} messages per day`,
          priority: 'high'
        });
      }
    }

    // Connection health insights
    if (stats.connectedSessions < stats.totalSessions) {
      insights.push({
        type: 'warning',
        icon: 'alert-circle',
        title: 'Connection Issues',
        description: `${stats.totalSessions - stats.connectedSessions} sessions are disconnected`,
        priority: 'medium'
      });
    }

    // Message volume insights
    if (stats.totalMessagesToday > 100) {
      insights.push({
        type: 'info',
        icon: 'chatbubbles',
        title: 'High Volume',
        description: 'You\'ve sent over 100 messages today',
        priority: 'low'
      });
    }

    return insights;
  };

  const generateTrends = (metrics) => {
    if (metrics.length < 2) return [];

    const trends = [];
    const recentMetrics = metrics.slice(-7); // Last 7 days

    // Calculate message volume trend
    const messageTrend = recentMetrics.reduce((sum, metric) => 
      sum + (metric.messages_sent || 0) + (metric.messages_received || 0), 0);
    
    if (messageTrend > 0) {
      trends.push({
        type: 'positive',
        metric: 'Message Volume',
        change: `+${messageTrend}%`,
        description: 'Increasing message activity'
      });
    }

    // Calculate connection time trend
    const connectionTrend = recentMetrics.reduce((sum, metric) => 
      sum + (metric.connection_time_minutes || 0), 0);
    
    if (connectionTrend > 0) {
      trends.push({
        type: 'positive',
        metric: 'Connection Time',
        change: `+${Math.round(connectionTrend / 60)}h`,
        description: 'Longer connection durations'
      });
    }

    return trends;
  };

  const getPeriodLabel = (period) => {
    switch (period) {
      case '1d': return '24 Hours';
      case '7d': return '7 Days';
      case '30d': return '30 Days';
      case '90d': return '90 Days';
      default: return '7 Days';
    }
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'warning': return 'alert-circle';
      case 'info': return 'information-circle';
      case 'error': return 'close-circle';
      default: return 'information-circle';
    }
  };

  const getInsightColor = (type) => {
    switch (type) {
      case 'success': return '#25D366';
      case 'warning': return '#FF9500';
      case 'info': return '#007AFF';
      case 'error': return '#FF3B30';
      default: return '#007AFF';
    }
  };

  const renderOverviewCard = () => (
    <Animated.View
      style={[
        dynamicStyles.overviewCardContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={dynamicStyles.overviewGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Card style={dynamicStyles.overviewCard}>
          <Card.Content>
            <Title style={dynamicStyles.overviewTitle}>Session Overview</Title>
            
            <View style={dynamicStyles.overviewStats}>
              <View style={dynamicStyles.overviewStat}>
                <Text style={dynamicStyles.overviewNumber}>{analytics.overview.totalSessions || 0}</Text>
                <Text style={dynamicStyles.overviewLabel}>Total Sessions</Text>
              </View>
              
              <View style={dynamicStyles.overviewStat}>
                <Text style={dynamicStyles.overviewNumber}>{analytics.overview.connectedSessions || 0}</Text>
                <Text style={dynamicStyles.overviewLabel}>Connected</Text>
              </View>
              
              <View style={dynamicStyles.overviewStat}>
                <Text style={dynamicStyles.overviewNumber}>{analytics.overview.totalMessagesToday || 0}</Text>
                <Text style={dynamicStyles.overviewLabel}>Messages Today</Text>
              </View>
              
              <View style={dynamicStyles.overviewStat}>
                <Text style={dynamicStyles.overviewNumber}>{Math.round((analytics.overview.totalConnectionTimeToday || 0) / 60)}h</Text>
                <Text style={dynamicStyles.overviewLabel}>Connection Time</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </LinearGradient>
    </Animated.View>
  );

  const renderPeriodSelector = () => (
    <Animated.View
      style={[
        dynamicStyles.periodSelectorContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      <Card style={dynamicStyles.periodSelectorCard}>
        <Card.Content>
          <Title style={dynamicStyles.periodSelectorTitle}>Time Period</Title>
          
          <View style={dynamicStyles.periodButtons}>
            {['1d', '7d', '30d', '90d'].map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  dynamicStyles.periodButton,
                  selectedPeriod === period && dynamicStyles.periodButtonSelected
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text style={[
                  dynamicStyles.periodButtonText,
                  selectedPeriod === period && dynamicStyles.periodButtonTextSelected
                ]}>
                  {getPeriodLabel(period)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card.Content>
      </Card>
    </Animated.View>
  );

  const renderSessionSelector = () => (
    <Animated.View
      style={[
        dynamicStyles.sessionSelectorContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      <Card style={dynamicStyles.sessionSelectorCard}>
        <Card.Content>
          <Title style={dynamicStyles.sessionSelectorTitle}>Session Filter</Title>
          
          <View style={dynamicStyles.sessionButtons}>
            <TouchableOpacity
              style={[
                dynamicStyles.sessionButton,
                selectedSession === 'all' && dynamicStyles.sessionButtonSelected
              ]}
              onPress={() => setSelectedSession('all')}
            >
              <Text style={[
                dynamicStyles.sessionButtonText,
                selectedSession === 'all' && dynamicStyles.sessionButtonTextSelected
              ]}>
                All Sessions
              </Text>
            </TouchableOpacity>
            
            {analytics.sessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={[
                  dynamicStyles.sessionButton,
                  selectedSession === session.id && dynamicStyles.sessionButtonSelected
                ]}
                onPress={() => setSelectedSession(session.id)}
              >
                <Text style={[
                  dynamicStyles.sessionButtonText,
                  selectedSession === session.id && dynamicStyles.sessionButtonTextSelected
                ]}>
                  {session.alias}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card.Content>
      </Card>
    </Animated.View>
  );

  const renderTrendsCard = () => (
    <Animated.View
      style={[
        dynamicStyles.trendsCardContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <Card style={dynamicStyles.trendsCard}>
        <Card.Content>
          <Title style={dynamicStyles.trendsTitle}>Trends & Patterns</Title>
          
          {analytics.trends.length > 0 ? (
            analytics.trends.map((trend, index) => (
              <View key={index} style={dynamicStyles.trendItem}>
                <View style={dynamicStyles.trendHeader}>
                  <Ionicons 
                    name="trending-up" 
                    size={20} 
                    color="#25D366" 
                  />
                  <Text style={dynamicStyles.trendMetric}>{trend.metric}</Text>
                  <Chip style={dynamicStyles.trendChange} textStyle={dynamicStyles.trendChangeText}>
                    {trend.change}
                  </Chip>
                </View>
                <Text style={dynamicStyles.trendDescription}>{trend.description}</Text>
              </View>
            ))
          ) : (
            <View style={dynamicStyles.noTrendsContainer}>
              <Ionicons name="trending-up" size={48} color="#ccc" />
              <Text style={dynamicStyles.noTrendsText}>No significant trends detected</Text>
              <Text style={dynamicStyles.noTrendsSubtext}>Continue using your sessions to see trends</Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </Animated.View>
  );

  const renderInsightsCard = () => (
    <Animated.View
      style={[
        dynamicStyles.insightsCardContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <Card style={dynamicStyles.insightsCard}>
        <Card.Content>
          <View style={dynamicStyles.insightsHeader}>
            <Title style={dynamicStyles.insightsTitle}>AI Insights</Title>
            <IconButton
              icon={showInsights ? 'chevron-up' : 'chevron-down'}
              onPress={() => setShowInsights(!showInsights)}
            />
          </View>
          
          {showInsights && (
            <View style={dynamicStyles.insightsContent}>
              {analytics.insights.length > 0 ? (
                analytics.insights.map((insight, index) => (
                  <View key={index} style={dynamicStyles.insightItem}>
                    <View style={dynamicStyles.insightHeader}>
                      <Ionicons 
                        name={getInsightIcon(insight.type)} 
                        size={20} 
                        color={getInsightColor(insight.type)} 
                      />
                      <Text style={dynamicStyles.insightTitle}>{insight.title}</Text>
                      <Chip 
                        style={[
                          dynamicStyles.insightPriority,
                          { backgroundColor: getInsightColor(insight.type) }
                        ]}
                        textStyle={dynamicStyles.insightPriorityText}
                      >
                        {insight.priority}
                      </Chip>
                    </View>
                    <Text style={dynamicStyles.insightDescription}>{insight.description}</Text>
                  </View>
                ))
              ) : (
                <View style={dynamicStyles.noInsightsContainer}>
                  <Ionicons name="bulb" size={48} color="#ccc" />
                  <Text style={dynamicStyles.noInsightsText}>No insights available</Text>
                  <Text style={dynamicStyles.noInsightsSubtext}>Continue using your sessions to generate insights</Text>
                </View>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
    </Animated.View>
  );

  const renderMetricsTable = () => (
    <Animated.View
      style={[
        dynamicStyles.metricsTableContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <Card style={dynamicStyles.metricsTableCard}>
        <Card.Content>
          <Title style={dynamicStyles.metricsTableTitle}>Detailed Metrics</Title>
          
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Date</DataTable.Title>
              <DataTable.Title numeric>Sent</DataTable.Title>
              <DataTable.Title numeric>Received</DataTable.Title>
              <DataTable.Title numeric>Connection Time</DataTable.Title>
              <DataTable.Title numeric>Errors</DataTable.Title>
            </DataTable.Header>

            {analytics.metrics.slice(0, 10).map((metric, index) => (
              <DataTable.Row key={index}>
                <DataTable.Cell>{new Date(metric.date).toLocaleDateString()}</DataTable.Cell>
                <DataTable.Cell numeric>{metric.messages_sent || 0}</DataTable.Cell>
                <DataTable.Cell numeric>{metric.messages_received || 0}</DataTable.Cell>
                <DataTable.Cell numeric>{Math.round((metric.connection_time_minutes || 0) / 60)}h</DataTable.Cell>
                <DataTable.Cell numeric>{metric.errors_count || 0}</DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        </Card.Content>
      </Card>
    </Animated.View>
  );

  return (
    <View style={dynamicStyles.container}>
      <ScrollView style={dynamicStyles.scrollView}>
        {/* Header */}
        <View style={dynamicStyles.header}>
          <Title style={dynamicStyles.headerTitle}>Session Analytics</Title>
          <Paragraph style={dynamicStyles.headerSubtitle}>
            Monitor performance and gain insights from your WhatsApp sessions
          </Paragraph>
        </View>

        {/* Overview Card */}
        {renderOverviewCard()}

        {/* Period Selector */}
        {renderPeriodSelector()}

        {/* Session Selector */}
        {renderSessionSelector()}

        {/* Trends Card */}
        {renderTrendsCard()}

        {/* Insights Card */}
        {renderInsightsCard()}

        {/* Metrics Table */}
        {renderMetricsTable()}
      </ScrollView>

      {/* FAB for refreshing analytics */}
      <FAB
        icon="refresh"
        style={dynamicStyles.fab}
        onPress={loadAnalytics}
        label="Refresh"
      />
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 22,
  },
  overviewCardContainer: {
    margin: 20,
    marginTop: 0,
  },
  overviewGradient: {
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  overviewCard: {
    backgroundColor: 'transparent',
    elevation: 0,
  },
  overviewTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  overviewStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  overviewStat: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 20,
  },
  overviewNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  periodSelectorContainer: {
    margin: 20,
    marginTop: 0,
  },
  periodSelectorCard: {
    elevation: 4,
    borderRadius: 16,
  },
  periodSelectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.onSurface,
  },
  periodButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceVariant,
    minWidth: 80,
    alignItems: 'center',
  },
  periodButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '600',
  },
  periodButtonTextSelected: {
    color: theme.colors.onPrimary,
  },
  sessionSelectorContainer: {
    margin: 20,
    marginTop: 0,
  },
  sessionSelectorCard: {
    elevation: 4,
    borderRadius: 16,
  },
  sessionSelectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.onSurface,
  },
  sessionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceVariant,
    minWidth: 80,
    alignItems: 'center',
  },
  sessionButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  sessionButtonText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    fontWeight: '600',
  },
  sessionButtonTextSelected: {
    color: theme.colors.onPrimary,
  },
  trendsCardContainer: {
    margin: 20,
    marginTop: 0,
  },
  trendsCard: {
    elevation: 4,
    borderRadius: 16,
  },
  trendsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.onSurface,
  },
  trendItem: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 12,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendMetric: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginLeft: 8,
    flex: 1,
  },
  trendChange: {
    backgroundColor: '#25D366',
  },
  trendChangeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  trendDescription: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginLeft: 28,
  },
  noTrendsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noTrendsText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginTop: 16,
    marginBottom: 8,
  },
  noTrendsSubtext: {
    fontSize: 14,
    color: theme.colors.outline,
    textAlign: 'center',
  },
  insightsCardContainer: {
    margin: 20,
    marginTop: 0,
  },
  insightsCard: {
    elevation: 4,
    borderRadius: 16,
  },
  insightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  insightsContent: {
    marginTop: 16,
  },
  insightItem: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginLeft: 8,
    flex: 1,
  },
  insightPriority: {
    height: 24,
  },
  insightPriorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  insightDescription: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginLeft: 28,
  },
  noInsightsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noInsightsText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginTop: 16,
    marginBottom: 8,
  },
  noInsightsSubtext: {
    fontSize: 14,
    color: theme.colors.outline,
    textAlign: 'center',
  },
  metricsTableContainer: {
    margin: 20,
    marginTop: 0,
    marginBottom: 40,
  },
  metricsTableCard: {
    elevation: 4,
    borderRadius: 16,
  },
  metricsTableTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.onSurface,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});

export default SessionAnalyticsScreen;
