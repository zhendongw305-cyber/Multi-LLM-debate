import MessageBubble from './MessageBubble'

interface Message {
  id: string
  role: string
  content: string
  createdAt: string
}

interface MessageListProps {
  messages: Message[]
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 bg-transparent">
      <div className="mx-auto max-w-3xl space-y-6 pb-32">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </div>
  )
}
