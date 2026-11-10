"use client";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { useEffect, useState, type FormEvent } from "react";
import { RequireVerified } from "@/components/guards/RequireVerified";
import { useAuth } from "@/lib/hooks/useAuth";
import { chatMessageInputSchema, chatStartInputSchema } from "@/lib/api/schemas";
import { db } from "@/lib/firebase/client";

type ChatSummary = {
  id: string;
  participants: string[];
  lastMessageText: string;
  lastSenderId: string | null;
};

type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  at: Timestamp | null;
};

function ChatContent() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [targetUid, setTargetUid] = useState("");
  const [draft, setDraft] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    return onSnapshot(
      query(collection(db, "chats"), where("participants", "array-contains", user.uid)),
      (snapshot) => {
        const nextChats = snapshot.docs.map((chat) => {
          const lastMessage = chat.get("lastMessage");
          const participants = chat.get("participants");
          return {
            id: chat.id,
            participants: Array.isArray(participants)
              ? participants.filter((participant): participant is string => typeof participant === "string")
              : [],
            lastMessageText:
              typeof lastMessage?.text === "string" ? lastMessage.text : "Start a conversation",
            lastSenderId: typeof lastMessage?.senderId === "string" ? lastMessage.senderId : null,
          };
        });
        setChats(nextChats);
        setIsLoadingChats(false);
        setError(null);
        setActiveChatId((current) =>
          current && nextChats.some((chat) => chat.id === current)
            ? current
            : nextChats[0]?.id ?? null,
        );
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setIsLoadingChats(false);
      },
    );
  }, [user]);

  useEffect(() => {
    if (!user || !activeChatId) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    return onSnapshot(
      query(
        collection(db, "chats", activeChatId, "messages"),
        orderBy("at", "asc"),
      ),
      (snapshot) => {
        setMessages(
          snapshot.docs.map((message) => ({
            id: message.id,
            text: typeof message.get("text") === "string" ? message.get("text") : "",
            senderId: typeof message.get("senderId") === "string" ? message.get("senderId") : "",
            at: (message.get("at") as Timestamp | undefined) ?? null,
          })),
        );
        setIsLoadingMessages(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setIsLoadingMessages(false);
      },
    );
  }, [activeChatId, user]);

  async function startConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || isStarting) {
      return;
    }

    const parsedInput = chatStartInputSchema.safeParse({ targetUid });
    if (!parsedInput.success) {
      setError("Enter another verified user’s UID.");
      return;
    }

    const otherUid = parsedInput.data.targetUid;
    if (!otherUid || otherUid === user.uid) {
      setError("Enter another verified user’s UID.");
      return;
    }

    setIsStarting(true);
    setError(null);
    try {
      const participants = [user.uid, otherUid].sort();
      const chatId = `${participants[0]}_${participants[1]}`;
      const chatRef = doc(db, "chats", chatId);
      const existingChat = await getDoc(chatRef);
      if (!existingChat.exists()) {
        await setDoc(chatRef, {
          participants,
          lastMessage: null,
          createdAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        });
      }
      setActiveChatId(chatId);
      setTargetUid("");
    } catch (startError: unknown) {
      setError(
        startError instanceof Error ? startError.message : "The conversation could not be started.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedInput = chatMessageInputSchema.safeParse({ text: draft });
    if (!user || !activeChatId || !parsedInput.success || isSending) {
      return;
    }

    const text = parsedInput.data.text;
    setIsSending(true);
    setError(null);
    try {
      const chatRef = doc(db, "chats", activeChatId);
      const messageRef = doc(collection(db, "chats", activeChatId, "messages"));
      const at = serverTimestamp();
      const batch = writeBatch(db);
      batch.set(messageRef, {
        text,
        senderId: user.uid,
        at,
        lastSeenAt: at,
      });
      batch.update(chatRef, {
        lastMessage: {
          messageId: messageRef.id,
          text,
          senderId: user.uid,
          at,
        },
        lastSeenAt: at,
      });
      await batch.commit();
      setDraft("");
    } catch (sendError: unknown) {
      setError(sendError instanceof Error ? sendError.message : "The message could not be sent.");
    } finally {
      setIsSending(false);
    }
  }

  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const otherParticipant = activeChat?.participants.find((participant) => participant !== user?.uid);

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-5xl gap-4 p-4 md:grid-cols-[16rem_1fr]">
      <aside className="space-y-4">
        <h1 className="text-2xl font-bold">Chats</h1>
        <form className="space-y-2" onSubmit={(event) => void startConversation(event)}>
          <label htmlFor="chat-recipient" className="text-sm">Start chat with verified user UID</label>
          <input
            id="chat-recipient"
            className="w-full rounded border p-2"
            value={targetUid}
            onChange={(event) => setTargetUid(event.target.value)}
            maxLength={128}
            required
          />
          <button type="submit" disabled={isStarting}>
            {isStarting ? "Starting…" : "Start conversation"}
          </button>
        </form>
        {isLoadingChats ? <p aria-live="polite">Loading chats…</p> : null}
        <ul className="space-y-2">
          {chats.map((chat) => {
            const participant = chat.participants.find((uid) => uid !== user?.uid);
            return (
              <li key={chat.id}>
                <button
                  type="button"
                  className={`w-full rounded border p-3 text-left ${activeChatId === chat.id ? "bg-muted" : ""}`}
                  onClick={() => setActiveChatId(chat.id)}
                >
                  <span className="block truncate text-sm">{participant ?? "Conversation"}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {chat.lastMessageText}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex min-h-[60vh] flex-col rounded-lg border p-4">
        <h2 className="border-b pb-3 font-semibold">{otherParticipant ?? "Select a conversation"}</h2>
        <div className="flex-1 space-y-3 overflow-y-auto py-4" aria-live="polite">
          {isLoadingMessages ? <p>Loading messages…</p> : null}
          {!isLoadingMessages && activeChatId && messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet. Say hello.</p>
          ) : null}
          {messages.map((message) => (
            <p
              key={message.id}
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg p-3 ${
                message.senderId === user?.uid ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {message.text}
              <span className="mt-1 block text-right text-xs opacity-70">
                {message.at?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? ""}
              </span>
            </p>
          ))}
        </div>
        {activeChatId ? (
          <form className="flex gap-2 border-t pt-3" onSubmit={(event) => void sendMessage(event)}>
            <label htmlFor="chat-message" className="sr-only">Message</label>
            <input
              id="chat-message"
              className="min-w-0 flex-1 rounded border p-2"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={2000}
              placeholder="Write a message"
              required
            />
            <button type="submit" disabled={isSending || !draft.trim()}>
              {isSending ? "Sending…" : "Send"}
            </button>
          </form>
        ) : null}
        {error ? <p role="alert" className="mt-3">{error}</p> : null}
      </section>
    </main>
  );
}

export default function ChatPage() {
  return (
    <RequireVerified>
      <ChatContent />
    </RequireVerified>
  );
}