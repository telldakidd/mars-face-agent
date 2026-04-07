import { View, Text, Image, StyleSheet } from 'react-native';

type ChatBubbleProps = {
  message: string;
  role: 'user' | 'agent';
  timestamp: string;
  imageUri?: string;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function ChatBubble({ message, role, timestamp, imageUri }: ChatBubbleProps) {
  const isAgent = role === 'agent';

  return (
    <View
      style={[
        styles.container,
        isAgent ? styles.agentContainer : styles.userContainer,
      ]}
    >
      {isAgent && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>M</Text>
        </View>
      )}
      <View style={styles.bubbleWrapper}>
        <View
          style={[
            styles.bubble,
            isAgent ? styles.agentBubble : styles.userBubble,
          ]}
        >
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
            />
          )}
          {message ? <Text style={styles.messageText}>{message}</Text> : null}
        </View>
        <Text
          style={[
            styles.timestamp,
            isAgent ? styles.timestampLeft : styles.timestampRight,
          ]}
        >
          {formatTime(timestamp)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 14,
    maxWidth: '85%',
  },
  agentContainer: {
    alignSelf: 'flex-start',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#161b22',
    borderWidth: 1.5,
    borderColor: '#00e5ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  avatarText: {
    color: '#00e5ff',
    fontSize: 13,
    fontWeight: '700',
  },
  bubbleWrapper: {
    flexShrink: 1,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  agentBubble: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: 'rgba(179, 136, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(179, 136, 255, 0.3)',
    borderTopRightRadius: 4,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  messageText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  timestamp: {
    color: '#8b949e',
    fontSize: 10,
    marginTop: 4,
  },
  timestampLeft: {
    textAlign: 'left',
    marginLeft: 4,
  },
  timestampRight: {
    textAlign: 'right',
    marginRight: 4,
  },
});
