import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ChatBubble from '@/components/ChatBubble';
import AgentAvatar from '@/components/AgentAvatar';
import type { Message } from '@/types';

type AgentStatus = 'online' | 'thinking' | 'offline';

const AGENT_RESPONSES = [
  "I've checked your accounts -- MT5 gold is up 1.8% since market open, and your Polymarket positions are holding steady. No action needed right now.",
  "Your portfolio is performing well today. The XAUUSD long from yesterday is currently +$340 in unrealized profit. I'd recommend holding through the Asian session.",
  "I've noticed increased volatility on gold futures. Your current stop-loss at $2,285 gives you about 0.6% downside risk, which is within your moderate tier threshold.",
  "Polymarket update: your YES position on the Fed rate hold is now at 78 cents, up from your 62-cent entry. That's a 25.8% gain. I'll keep monitoring.",
  "I'll rerun the risk scan now. One moment while I check exposure across all platforms.",
  "All clear on the risk front. Total exposure is 34% of equity, well within your moderate-tier limit of 50%. No breaches detected.",
];

const IMAGE_RESPONSES = [
  "I've received your image. Let me analyze what I see and get back to you with my assessment.",
  "Got the screenshot. I can see the chart pattern you're referring to — looks like a potential breakout forming. I'll monitor this closely.",
  "Thanks for sharing that. I've logged this for reference. Is there anything specific you'd like me to focus on?",
  "Image received and processed. I can use this context for our conversation going forward.",
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'agent',
      content: "Good morning. I've reviewed your overnight positions -- everything is within normal parameters. MT5 gold is up 0.4% pre-market. How can I help you today?",
      timestamp: new Date(Date.now() - 60000).toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AgentStatus>('online');
  const [showAttach, setShowAttach] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const addMessageAndRespond = useCallback(
    async (userMsg: Message, isImage: boolean) => {
      setMessages((prev) => [...prev, userMsg]);
      setStatus('thinking');

      await new Promise((resolve) =>
        setTimeout(resolve, 1500 + Math.random() * 1500)
      );

      const responses = isImage ? IMAGE_RESPONSES : AGENT_RESPONSES;
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, agentMessage]);
      setStatus('online');
    },
    []
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setInput('');
    await addMessageAndRespond(userMessage, false);
  }, [input, addMessageAndRespond]);

  const pickImage = useCallback(async () => {
    setShowAttach(false);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: '',
      timestamp: new Date().toISOString(),
      imageUri: asset.uri,
    };

    await addMessageAndRespond(userMessage, true);
  }, [addMessageAndRespond]);

  const takePhoto = useCallback(async () => {
    setShowAttach(false);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in Settings.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: '',
      timestamp: new Date().toISOString(),
      imageUri: asset.uri,
    };

    await addMessageAndRespond(userMessage, true);
  }, [addMessageAndRespond]);

  const statusColor =
    status === 'online'
      ? '#2ea043'
      : status === 'thinking'
        ? '#d29922'
        : '#f85149';

  const statusLabel =
    status === 'online'
      ? 'Online'
      : status === 'thinking'
        ? 'Thinking...'
        : 'Offline';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Agent Header */}
      <View style={styles.header}>
        <AgentAvatar size={48} status={status} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>Mars Concierge</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatBubble
            message={item.content}
            role={item.role}
            timestamp={item.timestamp}
            imageUri={item.imageUri}
          />
        )}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* Attachment menu */}
      {showAttach && (
        <View style={styles.attachMenu}>
          <TouchableOpacity style={styles.attachOption} onPress={takePhoto}>
            <View style={[styles.attachIcon, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
              <Text style={[styles.attachIconText, { color: '#00e5ff' }]}>C</Text>
            </View>
            <Text style={styles.attachLabel}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={pickImage}>
            <View style={[styles.attachIcon, { backgroundColor: 'rgba(179, 136, 255, 0.15)' }]}>
              <Text style={[styles.attachIconText, { color: '#b388ff' }]}>P</Text>
            </View>
            <Text style={styles.attachLabel}>Photos</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={() => setShowAttach(!showAttach)}
        >
          <Text style={styles.attachButtonText}>{showAttach ? '×' : '+'}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask Mars Concierge..."
          placeholderTextColor="#8b949e"
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          onFocus={() => setShowAttach(false)}
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || status === 'thinking'}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05060a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
    backgroundColor: '#0d1117',
  },
  headerInfo: {
    marginLeft: 12,
  },
  headerName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexGrow: 1,
  },

  // Attachment menu
  attachMenu: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    backgroundColor: '#0d1117',
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
  },
  attachOption: {
    alignItems: 'center',
    gap: 6,
  },
  attachIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachIconText: {
    fontSize: 20,
    fontWeight: '800',
  },
  attachLabel: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '500',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
    backgroundColor: '#0d1117',
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  attachButtonText: {
    color: '#00e5ff',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  input: {
    flex: 1,
    backgroundColor: '#161b22',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#1a1f2e',
  },
  sendButton: {
    backgroundColor: '#00e5ff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginLeft: 8,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#05060a',
    fontSize: 14,
    fontWeight: '700',
  },
});
