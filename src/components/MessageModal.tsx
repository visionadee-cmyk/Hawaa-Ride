import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { db } from '@/src/firebase';

const QUICK_MESSAGES = [
  'I am on my way',
  'I have arrived',
  'I am nearby',
  'Please come to the pickup location',
  'I need to cancel the ride',
  'Traffic is heavy, please wait',
  'Almost there',
  'Please be ready',
];

type Message = {
  id: string;
  text: string;
  sender: 'driver' | 'rider';
  createdAt: any;
};

type MessageModalProps = {
  visible: boolean;
  rideId: string;
  currentUserRole: 'driver' | 'rider';
  otherPartyName: string;
  onClose: () => void;
};

export function MessageModal({ visible, rideId, currentUserRole, otherPartyName, onClose }: MessageModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || !rideId) return;
    setLoading(true);
    const q = query(
      collection(db, 'rides', rideId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setLoading(false);
    });
    return unsub;
  }, [visible, rideId]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !rideId) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'rides', rideId, 'messages'), {
        text: text.trim(),
        sender: currentUserRole,
        createdAt: serverTimestamp(),
      });
      setNewMessage('');
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
    }
  };

  const sendQuickMessage = (text: string) => {
    sendMessage(text);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Chat with {otherPartyName}</ThemedText>
            <Pressable onPress={onClose}>
              <ThemedText style={styles.closeBtn}>✕</ThemedText>
            </Pressable>
          </View>

          <View style={styles.quickMessages}>
            <FlatList
              horizontal
              data={QUICK_MESSAGES}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.quickBtn}
                  onPress={() => sendQuickMessage(item)}
                >
                  <ThemedText style={styles.quickText}>{item}</ThemedText>
                </Pressable>
              )}
            />
          </View>

          <View style={styles.messagesList}>
            {loading ? (
              <ActivityIndicator style={{ marginTop: 20 }} />
            ) : messages.length === 0 ? (
              <ThemedText style={styles.noMessages}>No messages yet</ThemedText>
            ) : (
              messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    msg.sender === currentUserRole
                      ? styles.myMessage
                      : styles.theirMessage,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.messageText,
                      msg.sender === currentUserRole
                        ? styles.myMessageText
                        : styles.theirMessageText,
                    ]}
                  >
                    {msg.text}
                  </ThemedText>
                </View>
              ))
            )}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor="#999"
            />
            <Pressable
              style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
              onPress={() => sendMessage(newMessage)}
              disabled={!newMessage.trim() || sending}
            >
              <ThemedText style={styles.sendBtnText}>Send</ThemedText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeBtn: {
    fontSize: 20,
    color: '#666',
  },
  quickMessages: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  quickBtn: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  quickText: {
    fontSize: 13,
    color: '#333',
  },
  messagesList: {
    flex: 1,
    padding: 16,
  },
  noMessages: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0B9E3D',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 15,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#0B9E3D',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#ccc',
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
