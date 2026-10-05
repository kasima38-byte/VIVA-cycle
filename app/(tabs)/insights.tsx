import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChartCard from '../../components/ChartCard';
import InsightSummaryCard from '../../components/InsightSummaryCard';
import SegmentedTabs from '../../components/SegmentedTabs';
import TipCard from '../../components/TipCard';
import { cycleHistory } from '../../constants/insightsData';
import {
  CYCLE_RANGE,
  PERIOD_RANGE,
  RangeKey,
  average,
  calculateCommonSymptoms,
  calculateCycleRegularity,
  calculateMoodPattern,
  calculateTypicalFertileWindow,
  formatAverage,
  generatePersonalInsight,
  isWithin,
  selectRecords,
} from '../../constants/insightsCalc';
import { colors, radius, spacing } from '../../constants/theme';

const RANGE_LABELS: Record<string, RangeKey> = {
  'This Cycle': 'cycle',
  '3 Months': '3m',
  '6 Months': '6m',
  '12 Months': '12m',
};

export default function InsightsScreen() {
  const [rangeLabel, setRangeLabel] = useState('This Cycle');
  const range = RANGE_LABELS[rangeLabel];

  const records = useMemo(() => selectRecords(cycleHistory, range), [range]);

  const cycleAvg = average(records.map((r) => r.cycleLength));
  const periodAvg = average(records.map((r) => r.periodLength));
  const regularity = calculateCycleRegularity(records);
  const symptoms = calculateCommonSymptoms(records);
  const mood = calculateMoodPattern(records);
  const fertile = calculateTypicalFertileWindow(records);
  const personalInsight = generatePersonalInsight(records);

  const cycleData = records.map((r, i) => ({
    label: r.month,
    value: r.cycleLength,
    current: i === records.length - 1,
  }));
  const periodData = records.map((r, i) => ({
    label: r.month,
    value: r.periodLength,
    current: i === records.length - 1,
  }));

  const heroTitle =
    regularity.label === 'Regular'
      ? 'Your cycle is regular!'
      : regularity.label === 'Not enough data'
      ? 'Keep tracking to discover your pattern.'
      : 'Your cycle varies a little.';
      
  const cycleAvgText = cycleAvg === null ? '-' : formatAverage(cycleAvg) + ' days';
  const periodAvgText = periodAvg === null ? '-' : formatAverage(periodAvg) + ' days';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={{ flex: 1 }} />
              {/* VIVA Cycle logo reserved here once the official asset is supplied */}
              <View style={{ width: 90, height: 40 }} />
            </View>
            <Text style={styles.title}>Insights</Text>
            <Text style={styles.subtitle}>Your patterns. Your power.</Text>
          </View>

          <SegmentedTabs
            tabs={['This Cycle', '3 Months', '6 Months', '12 Months']}
            activeTab={rangeLabel}
            onChange={setRangeLabel}
          />

          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroBody}>Your average cycle length is</Text>
            <Text style={styles.heroNumber}>{cycleAvgText}</Text>
          </View>

          <ChartCard
            title="Cycle Length"
            subtitle={'Your last ' + records.length + ' cycles'}
            data={cycleData}
            averageText={cycleAvgText}
            withinRange={isWithin(cycleAvg, CYCLE_RANGE)}
            rangeText="(21 - 35 days)"
            chartLabel="Cycle length chart"
          />

          <ChartCard
            title="Period Length"
            subtitle={'Your last ' + records.length + ' periods'}
            data={periodData}
            averageText={periodAvgText}
            withinRange={isWithin(periodAvg, PERIOD_RANGE)}
            rangeText="(2 - 7 days)"
            chartLabel="Period length chart"
          />

          <View style={styles.gridRow}>
            <InsightSummaryCard
              icon="calendar"
              title="Cycle Regularity"
              value={regularity.label}
              detail={regularity.variation === null ? undefined : 'Variation: ±' + regularity.variation + ' days'}
            />
            <InsightSummaryCard
              icon="flash"
              title="Most Common Symptoms"
              value={symptoms.length ? symptoms.join(', ') : 'Not enough data yet'}
            />
          </View>
          <View style={styles.gridRow}>
            <InsightSummaryCard icon="flower" title="Fertile Window" value={fertile} />
            <InsightSummaryCard icon="happy" title="Mood Pattern" value={mood} />
          </View>

          {personalInsight ? <TipCard title="Insight for You" body={personalInsight} /> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: 40,
    gap: spacing.lg,
  },
  header: { gap: 6 },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 32, fontWeight: '700', color: colors.navy },
  subtitle: { fontSize: 16, color: colors.textSecondary },
  hero: {
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  heroTitle: { fontSize: 19, fontWeight: '700', color: colors.navy },
  heroBody: { fontSize: 14.5, color: colors.textSecondary, marginTop: 6 },
  heroNumber: { fontSize: 38, fontWeight: '800', color: colors.magenta, marginTop: 2 },
  gridRow: { flexDirection: 'row', gap: spacing.sm },
});