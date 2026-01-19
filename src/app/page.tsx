"use client";

import { useState, useRef, useEffect } from "react";
import {
  ImagePlus,
  Send,
  Sparkles,
  Download,
  Loader2,
  ChefHat,
  X,
  RefreshCw
} from "lucide-react";

type MessageType = "user" | "assistant" | "system";

interface Message {
  id: string;
  type: MessageType;
  content?: string;
  imageUrl?: string;
  isLoading?: boolean;
  timestamp: Date;
}

const PRESET_PROMPTS = [
  {
    label: "Add Elegant Diners",
    prompt: "Transform this restaurant photo by adding elegant, sophisticated diners enjoying their meal. Show couples and small groups in upscale attire, engaged in pleasant conversation. Warm ambient lighting, realistic photography style. The people should look natural and blend seamlessly with the existing environment.",
  },
  {
    label: "Busy Lunch Scene",
    prompt: "Add a vibrant lunch crowd to this restaurant space. Show business professionals and casual diners enjoying their meals. Natural daylight, lively atmosphere with realistic people in smart casual attire. Maintain the original ambiance while making it feel popular and welcoming.",
  },
  {
    label: "Romantic Evening",
    prompt: "Transform this into a romantic evening scene with couples enjoying intimate dinners. Soft candlelight ambiance, elegant attire, wine glasses raised. Create a warm, luxurious atmosphere perfect for date night marketing.",
  },
  {
    label: "Group Celebration",
    prompt: "Add a festive group celebration to this space - a birthday party or special occasion with happy guests, some raising glasses in a toast. Mixed ages, joyful expressions, celebratory atmosphere while maintaining the restaurant's authentic style.",
  },
];

const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || "https://hanumet.app.n8n.cloud/webhook/content-creator";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "system",
      content: "Welcome! Drop a photo of your restaurant space and I'll help transform it with AI-generated content. Choose a preset or describe what you'd like to see.",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (customPrompt?: string) => {
    const prompt = customPrompt || inputText;
    if (!selectedImage || !prompt.trim()) return;

    setIsProcessing(true);

    // Add user message
    const userMessageId = Date.now().toString();
    const userMessage: Message = {
      id: userMessageId,
      type: "user",
      content: prompt,
      imageUrl: selectedImage,
      timestamp: new Date(),
    };

    // Add loading message
    const loadingMessageId = (Date.now() + 1).toString();
    const loadingMessage: Message = {
      id: loadingMessageId,
      type: "assistant",
      isLoading: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setInputText("");

    try {
      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64Data = selectedImage.split(",")[1];

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64Data,
          prompt: prompt,
          style: "realistic",
        }),
      });

      const data = await response.json();

      // Update loading message with result
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                isLoading: false,
                content: data.success
                  ? "Here's your transformed image!"
                  : "Sorry, something went wrong. Please try again.",
                imageUrl: data.success ? data.imageUrl : undefined,
              }
            : msg
        )
      );
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                isLoading: false,
                content: "Connection error. Please check your network and try again.",
              }
            : msg
        )
      );
    } finally {
      setIsProcessing(false);
      setSelectedImage(null);
      setSelectedImageFile(null);
    }
  };

  const handlePresetClick = (prompt: string) => {
    if (selectedImage) {
      handleSubmit(prompt);
    } else {
      setInputText(prompt);
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setSelectedImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <main className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-white/10">
        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
          <ChefHat className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Restaurant Content Creator</h1>
          <p className="text-sm text-white/60">AI-powered image transformation</p>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`animate-fade-in flex ${
              message.type === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 ${
                message.type === "user"
                  ? "bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30"
                  : message.type === "system"
                  ? "bg-white/5 border border-white/10"
                  : "bg-white/10 border border-white/10"
              }`}
            >
              {message.isLoading ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <div>
                    <p className="text-white/80">Creating your image...</p>
                    <p className="text-xs text-white/50 mt-1">This may take 15-30 seconds</p>
                  </div>
                </div>
              ) : (
                <>
                  {message.imageUrl && (
                    <div className="mb-3 relative group">
                      <img
                        src={message.imageUrl}
                        alt="Content"
                        className="rounded-xl max-h-80 object-contain"
                      />
                      {message.type === "assistant" && (
                        <a
                          href={message.imageUrl}
                          download="restaurant-ai-content.png"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute bottom-2 right-2 p-2 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Download className="w-4 h-4 text-white" />
                        </a>
                      )}
                    </div>
                  )}
                  {message.content && (
                    <p className="text-white/90 text-sm leading-relaxed">
                      {message.content}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Preset Prompts */}
      {!isProcessing && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {PRESET_PROMPTS.map((preset, index) => (
              <button
                key={index}
                onClick={() => handlePresetClick(preset.prompt)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/80 hover:text-white transition-all"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-white/10">
        {/* Selected Image Preview */}
        {selectedImage && (
          <div className="mb-3 relative inline-block">
            <img
              src={selectedImage}
              alt="Selected"
              className="h-20 rounded-lg object-cover border border-white/20"
            />
            <button
              onClick={clearSelectedImage}
              className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}

        {/* Drop Zone / Input */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`flex items-end gap-3 p-3 bg-white/5 rounded-2xl border ${
            selectedImage ? "border-amber-500/50" : "border-white/10"
          } transition-colors`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50"
          >
            <ImagePlus className="w-5 h-5 text-white/70" />
          </button>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              selectedImage
                ? "Describe how you want to transform this image..."
                : "First, drop or select an image of your restaurant..."
            }
            disabled={isProcessing}
            className="flex-1 bg-transparent text-white placeholder-white/40 resize-none outline-none text-sm min-h-[44px] max-h-32"
            rows={1}
          />

          <button
            onClick={() => handleSubmit()}
            disabled={isProcessing || !selectedImage || !inputText.trim()}
            className="p-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        <p className="text-center text-xs text-white/40 mt-3">
          Powered by Nano Banana AI • Drop an image or click the image icon to upload
        </p>
      </div>
    </main>
  );
}
