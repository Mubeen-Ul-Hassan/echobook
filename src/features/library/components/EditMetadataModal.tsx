import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { AudiobookRecord } from '@/database/types';

interface EditMetadataModalProps {
  visible: boolean;
  book: AudiobookRecord | null;
  onSave: (fields: {
    title: string;
    author: string | null;
    narrator: string | null;
    genre: string | null;
    year: number | null;
    description: string | null;
  }) => Promise<void>;
  onClose: () => void;
}

export function EditMetadataModal({ visible, book, onSave, onClose }: EditMetadataModalProps) {
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [narrator, setNarrator] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (book) {
      setTitle(book.title || '');
      setAuthor(book.author || '');
      setNarrator(book.narrator || '');
      setGenre(book.genre || '');
      setYear(book.year ? String(book.year) : '');
      setDescription(book.description || '');
    }
  }, [book]);

  if (!visible || !book) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        author: author.trim() || null,
        narrator: narrator.trim() || null,
        genre: genre.trim() || null,
        year: year.trim() && !isNaN(Number(year)) ? Number(year) : null,
        description: description.trim() || null,
      });
      onClose();
    } catch (err) {
      console.warn('[EditMetadataModal] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.overlay}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.avoidingView}
      >
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.headerRow}>
            <MaterialIcons name="edit" size={22} color={theme.accent} />
            <ThemedText style={styles.headerTitle}>Edit Metadata</ThemedText>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
            <ThemedText style={styles.label}>Title *</ThemedText>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Book Title"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />

            <ThemedText style={styles.label}>Author</ThemedText>
            <TextInput
              value={author}
              onChangeText={setAuthor}
              placeholder="Author Name"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />

            <ThemedText style={styles.label}>Narrator</ThemedText>
            <TextInput
              value={narrator}
              onChangeText={setNarrator}
              placeholder="Narrator Name"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />

            <View style={styles.row}>
              <View style={styles.flexOne}>
                <ThemedText style={styles.label}>Genre</ThemedText>
                <TextInput
                  value={genre}
                  onChangeText={setGenre}
                  placeholder="Genre"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </View>

              <View style={styles.flexOne}>
                <ThemedText style={styles.label}>Year</ThemedText>
                <TextInput
                  value={year}
                  onChangeText={setYear}
                  placeholder="Year"
                  keyboardType="numeric"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </View>
            </View>

            <ThemedText style={styles.label}>Description</ThemedText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Synopsis / Summary"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.border }]}
            />
          </ScrollView>

          <View style={styles.actionRow}>
            <Pressable
              onPress={onClose}
              style={[styles.btn, styles.cancelBtn, { backgroundColor: theme.backgroundSelected }]}
            >
              <ThemedText themeColor="textSecondary" style={styles.btnText}>Cancel</ThemedText>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={isSaving || !title.trim()}
              style={[
                styles.btn,
                styles.saveBtn,
                { backgroundColor: theme.accent, opacity: isSaving || !title.trim() ? 0.6 : 1 },
              ]}
            >
              <ThemedText style={[styles.btnText, { color: '#000', fontWeight: '700' }]}>Save</ThemedText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 20,
  },
  avoidingView: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    maxHeight: '90%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginLeft: 8,
  },
  closeBtn: {
    padding: 4,
  },
  formContent: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flexOne: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 1,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
