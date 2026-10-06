import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── VIVA Cycle colours ─────────────────────────────────────────────
const COLORS = {
  navy: '#0B1F4F',
  muted: '#5B6785',
  pink: '#E9006F',
  pinkSoft: '#FDE4EF',
  pinkCard: '#FFF7FA',
  pinkBorder: '#F8E3EC',
  purple: '#7C3AED',
  lavenderSoft: '#ECE3FD',
  lavenderCard: '#F8F4FF',
  lavenderHero: '#F3EDFF',
  lavenderBorder: '#E6DAFB',
  white: '#FFFFFF',
  border: '#F0E9F3',
};

// ─── Date helpers (no Intl, so it works the same on Android) ────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

type DateLike = Date | string;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Accepts a Date or a 'YYYY-MM-DD' string from the cycle engine
const toDate = (v: DateLike): Date => {
  if (v instanceof Date) return startOfDay(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return startOfDay(new Date(v));
};

const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);

const formatShort = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`; // 19 Sep
const formatLong = (d: Date) => `${formatShort(d)} ${d.getFullYear()}`; // 19 Sep 2026

const formatRange = (a: Date, b: Date) =>
  a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}` // 14 – 19 Sep
    : `${formatShort(a)} – ${formatShort(b)}`; // 28 Sep – 3 Oct

const formatRelative = (days: number) => {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
};

// ─── Types ──────────────────────────────────────────────────────────
type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type InsightId = 'fertile' | 'cycleLength' | 'periodLength' | 'ovulation';
export type UpcomingId = 'period' | 'fertileEnd' | 'ovulation';

type Props = {
  today: DateLike;
  cycleLength: number;
  periodLength: number;
  fertileWindow?: { start: DateLike; end: DateLike } | null;
  ovulationDate?: DateLike | null;
  nextPeriod?: DateLike | null;
  onViewDetails?: () => void;
  onSeeAll?: () => void;
  onPressInsight?: (id: InsightId) => void;
  onPressUpcoming?: (id: UpcomingId) => void;
};

// ─── Small building blocks ──────────────────────────────────────────
function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" style={styles.sectionAction}>
        <Text style={styles.sectionActionText}>{action}</Text>
        <Ionicons name="chevron-forward" size={18} color={COLORS.pink} />
      </Pressable>
    </View>
  );
}

type InsightCardProps = {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  cardBg: string;
  borderColor: string;
  title: string;
  value: string;
  subtitle: string;
  hero?: boolean;
  onPress?: () => void;
};

function InsightCard({ icon, iconColor, iconBg, cardBg, borderColor, title, value, subtitle, hero, onPress }: InsightCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${value}. ${subtitle}`}
      style={({ pressed }) => [
        styles.insightCard,
        hero && styles.heroCard,
        { backgroundColor: cardBg, borderColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.insightIcon, hero && styles.heroIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={hero ? 30 : 28} color={iconColor} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.insightTitle}>{title}</Text>
        <Text style={[styles.insightValue, hero && styles.heroValue]}>{value}</Text>
        <Text style={styles.insightSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={COLORS.navy} />
    </Pressable>
  );
}

type UpcomingCardProps = {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
};

function UpcomingCard({ icon, iconColor, iconBg, title, subtitle, onPress }: UpcomingCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [styles.upcomingCard, pressed && styles.pressed]}
    >
      <View style={[styles.upcomingIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.upcomingTitle}>{title}</Text>
        <Text style={styles.upcomingSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={COLORS.navy} />
    </Pressable>
  );
}

// ─── Main section ───────────────────────────────────────────────────
// All dates come from VIVA's shared cycle engine — this file only displays them.
export default function CycleInsightsSection({
  today,
  cycleLength,
  periodLength,
  fertileWindow,
  ovulationDate,
  nextPeriod,
  onViewDetails,
  onSeeAll,
  onPressInsight,
  onPressUpcoming,
}: Props) {
  const now = toDate(today);
  const fwStart = fertileWindow ? toDate(fertileWindow.start) : null;
  const fwEnd = fertileWindow ? toDate(fertileWindow.end) : null;
  const ovulation = ovulationDate ? toDate(ovulationDate) : null;
  const next = nextPeriod ? toDate(nextPeriod) : null;

  let fertileMessage = 'Log a period to see your estimated fertile window.';
  if (fwStart && fwEnd) {
    const toStart = daysBetween(now, fwStart);
    const toEnd = daysBetween(now, fwEnd);
    if (toStart > 1) fertileMessage = `Your estimated fertile window may start in ${toStart} days.`;
    else if (toStart === 1) fertileMessage = 'Your estimated fertile window may start tomorrow.';
    else if (toEnd >= 0) fertileMessage = 'You may be in your estimated fertile window.';
    else fertileMessage = 'This cycle’s estimated fertile window has passed.';
  }

  const candidates = [
    { id: 'period' as const, title: 'Period expected', date: next, icon: 'water' as IconName, iconColor: COLORS.pink, iconBg: COLORS.pinkSoft },
    { id: 'fertileEnd' as const, title: 'Estimated fertile window ends', date: fwEnd, icon: 'leaf' as IconName, iconColor: COLORS.pink, iconBg: COLORS.pinkSoft },
    { id: 'ovulation' as const, title: 'Estimated ovulation', date: ovulation, icon: 'radio-button-on' as IconName, iconColor: COLORS.purple, iconBg: COLORS.lavenderSoft },
  ];

  const upcoming = candidates
    .flatMap((e) => (e.date ? [{ ...e, date: e.date, days: daysBetween(now, e.date) }] : []))
    .filter((e) => e.days >= 0) // hide events that already happened
    .sort((a, b) => a.days - b.days); // soonest first

  return (
    <View style={styles.container}>
      {/* ── Cycle Insights ── */}
      <View style={styles.section}>
        <SectionHeader title="Cycle Insights" action="View Details" onPress={onViewDetails} />
        <View style={styles.list}>
          <InsightCard
            hero
            icon="leaf"
            iconColor={COLORS.purple}
            iconBg={COLORS.lavenderSoft}
            cardBg={COLORS.lavenderHero}
            borderColor={COLORS.lavenderBorder}
            title="Estimated fertile window"
            value={fwStart && fwEnd ? formatRange(fwStart, fwEnd) : '–'}
            subtitle={fertileMessage}
            onPress={() => onPressInsight?.('fertile')}
          />
          <InsightCard
            icon="calendar"
            iconColor={COLORS.pink}
            iconBg={COLORS.pinkSoft}
            cardBg={COLORS.pinkCard}
            borderColor={COLORS.pinkBorder}
            title="Typical cycle length"
            value={`${cycleLength} days`}
            subtitle="Used for your predictions"
            onPress={() => onPressInsight?.('cycleLength')}
          />
          <InsightCard
            icon="water"
            iconColor={COLORS.pink}
            iconBg={COLORS.pinkSoft}
            cardBg={COLORS.pinkCard}
            borderColor={COLORS.pinkBorder}
            title="Typical period length"
            value={`${periodLength} days`}
            subtitle="Used for your predictions"
            onPress={() => onPressInsight?.('periodLength')}
          />
          <InsightCard
            icon="radio-button-on"
            iconColor={COLORS.purple}
            iconBg={COLORS.lavenderSoft}
            cardBg={COLORS.lavenderCard}
            borderColor={COLORS.lavenderBorder}
            title="Estimated ovulation"
            value={ovulation ? formatShort(ovulation) : '–'}
            subtitle="Estimated ovulation date"
            onPress={() => onPressInsight?.('ovulation')}
          />
        </View>
      </View>

      {/* ── Upcoming ── */}
      <View style={styles.section}>
        <SectionHeader title="Upcoming" action="See All" onPress={onSeeAll} />
        <View style={styles.listTight}>
          {upcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.upcomingSubtitle}>Log a period to see what’s coming up.</Text>
            </View>
          ) : (
            upcoming.map((e) => (
              <UpcomingCard
                key={e.id}
                icon={e.icon}
                iconColor={e.iconColor}
                iconBg={e.iconBg}
                title={e.title}
                subtitle={`${formatRelative(e.days)}  (${formatLong(e.date)})`}
                onPress={() => onPressUpcoming?.(e.id)}
              />
            ))
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
const cardShadow = {
  shadowColor: COLORS.navy,
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 1,
};

const styles = StyleSheet.create({
  container: { gap: 28 },
  section: { gap: 14 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: -0.4,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
  },
  sectionActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.pink,
  },
  list: { gap: 12 },
  listTight: { gap: 10 },

  // Insight cards
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    ...cardShadow,
  },
  heroCard: {
    paddingVertical: 22,
    borderRadius: 24,
  },
  insightIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  cardText: { flex: 1, gap: 2 },
  insightTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  insightValue: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: -0.4,
  },
  heroValue: { fontSize: 28 },
  insightSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },

  // Upcoming cards
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    ...cardShadow,
  },
  upcomingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  upcomingSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
  },
  emptyCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },

  pressed: { opacity: 0.7 },
});