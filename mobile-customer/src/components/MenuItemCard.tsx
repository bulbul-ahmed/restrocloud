import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native'
import { COLORS } from '../constants/colors'
import type { MenuItem } from '../types/menu.types'

interface Props {
  item: MenuItem
  onPress: () => void
  currency?: string
}

export function MenuItemCard({ item, onPress, currency = '$' }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, !item.isAvailable && styles.unavailable]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!item.isAvailable}
    >
      <View style={styles.content}>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <View style={styles.footer}>
            <Text style={styles.price}>{currency}{parseFloat(item.price).toFixed(2)}</Text>
            {!item.isAvailable && (
              <Text style={styles.unavailableLabel}>Unavailable</Text>
            )}
          </View>
          {item.dietaryTags && item.dietaryTags.length > 0 && (
            <View style={styles.tags}>
              {item.dietaryTags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoEmoji}>🍽</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  unavailable: { opacity: 0.5 },
  content: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  info: { flex: 1 },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.brand,
  },
  unavailableLabel: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: '600',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tag: {
    backgroundColor: COLORS.brandLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontSize: 10, color: COLORS.brand, fontWeight: '600' },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEmoji: { fontSize: 32 },
})
