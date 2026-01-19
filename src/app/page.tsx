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
  MessageSquare,
  Grid3X3,
  Trash2,
  ExternalLink
} from "lucide-react";

type MessageType = "user" | "assistant" | "system";
type ViewMode = "chat" | "gallery";

interface Message {
  id: string;
  type: MessageType;
  content?: string;
  imageUrl?: string;
  isLoading?: boolean;
  timestamp: Date;
}

interface GalleryImage {
  id: string;
  imageUrl: string;
  prompt: string;
  createdAt: string;
  originalImageUrl?: string;
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

// Storage key for gallery images
const GALLERY_STORAGE_KEY = "restaurant-content-gallery";

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "system",
      content: "Welcome to the Restaurant Content Creator Demo! Upload a photo of your EMPTY restaurant and watch AI fill it with realistic diners. Perfect for marketing materials when you can't do a real photoshoot. Choose a preset style or describe your vision!",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<GalleryImage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load gallery images from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (stored) {
      try {
        setGalleryImages(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse gallery images:", e);
      }
    }
  }, []);

  // Save gallery images to localStorage when updated
  useEffect(() => {
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(galleryImages));
  }, [galleryImages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add image to gallery
  const addToGallery = (imageUrl: string, prompt: string, originalImageUrl?: string) => {
    const newImage: GalleryImage = {
      id: Date.now().toString(),
      imageUrl,
      prompt,
      createdAt: new Date().toISOString(),
      originalImageUrl,
    };
    setGalleryImages(prev => [newImage, ...prev]);
  };

  // Remove image from gallery
  const removeFromGallery = (id: string) => {
    setGalleryImages(prev => prev.filter(img => img.id !== id));
  };

  // Clear all gallery images
  const clearGallery = () => {
    if (confirm("Are you sure you want to clear all gallery images?")) {
      setGalleryImages([]);
    }
  };

  // Compress image to max 300KB for faster upload and AI processing
  const compressImage = (file: File, maxSizeKB: number = 300): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;

          // Scale down to max 1200px for faster AI processing
          const maxDim = 1200;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height / width) * maxDim);
              width = maxDim;
            } else {
              width = Math.round((width / height) * maxDim);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          // Start with quality 0.6 and reduce if needed
          let quality = 0.6;
          let result = canvas.toDataURL("image/jpeg", quality);

          // Reduce quality until under target size
          while (result.length > maxSizeKB * 1024 && quality > 0.15) {
            quality -= 0.1;
            result = canvas.toDataURL("image/jpeg", quality);
          }

          console.log(`Compressed: ${width}x${height}, quality=${quality.toFixed(1)}, size=${Math.round(result.length/1024)}KB`);
          resolve(result);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const compressed = await compressImage(file);
      setSelectedImage(compressed);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImageFile(file);
      const compressed = await compressImage(file);
      setSelectedImage(compressed);
    }
  };

  const handleSubmit = async (customPrompt?: string) => {
    const prompt = customPrompt || inputText;
    if (!selectedImage || !prompt.trim()) return;

    setIsProcessing(true);
    const originalImageUrl = selectedImage;

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

      console.log("Sending request to:", N8N_WEBHOOK_URL);
      console.log("Image size:", Math.round(base64Data.length / 1024), "KB");

      // Use AbortController with 120 second timeout (AI processing takes time)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log("Response status:", response.status);

      const data = await response.json();
      console.log("API Response (full):", JSON.stringify(data, null, 2));
      console.log("Success:", data.success, "ImageUrl:", data.imageUrl);

      // Determine message based on status
      let content = "";
      let imageUrl: string | undefined = undefined;

      if (data.success === true && data.imageUrl && data.imageUrl.length > 0) {
        content = "Here's your transformed image!";
        imageUrl = data.imageUrl;
        console.log("Setting imageUrl to:", imageUrl);
        // Add to gallery on success
        addToGallery(data.imageUrl, prompt, originalImageUrl);
      } else if (data.status === "waiting" || data.status === "processing") {
        content = `Image is still processing (status: ${data.status}). The AI needs more time - try again in 30 seconds or use a smaller image.`;
      } else if (data.status === "failed") {
        content = `Generation failed: ${data.debug?.failMsg || "Unknown error"}. Please try with a different image.`;
      } else {
        content = `Something went wrong. Status: ${data.status || "unknown"}, Success: ${data.success}. Debug: ${JSON.stringify(data.debug || {})}`;
      }

      // Update loading message with result
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                isLoading: false,
                content,
                imageUrl,
              }
            : msg
        )
      );
    } catch (error) {
      console.error("Fetch error:", error);
      const errorMessage = error instanceof Error
        ? (error.name === 'AbortError'
          ? "Request timed out (120s). The AI is taking longer than expected. Please try again."
          : `Error: ${error.message}`)
        : "Connection error. Please check your network and try again.";

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                isLoading: false,
                content: errorMessage,
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
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Restaurant Content Creator</h1>
            <p className="text-sm text-white/60">AI-powered image transformation</p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setViewMode("chat")}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all ${
              viewMode === "chat"
                ? "bg-amber-500/20 text-amber-400"
                : "text-white/60 hover:text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setViewMode("gallery")}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all ${
              viewMode === "gallery"
                ? "bg-amber-500/20 text-amber-400"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            Gallery
            {galleryImages.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500/30 text-amber-300 text-xs rounded-full">
                {galleryImages.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {viewMode === "chat" ? (
        <>
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
                        <p className="text-xs text-white/50 mt-1">This may take 30-60 seconds</p>
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
                    ? "Describe the diners you want to add..."
                    : "First, upload a photo of your EMPTY restaurant..."
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
              Powered by <a href="https://instagram.com/AIrestohub" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">WWITHai</a> • Follow <a href="https://instagram.com/AIrestohub" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">@AIrestohub</a>
            </p>
          </div>
        </>
      ) : (
        /* Gallery View */
        <div className="flex-1 overflow-y-auto p-4">
          {/* Gallery Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Generated Images
              <span className="ml-2 text-sm font-normal text-white/50">
                ({galleryImages.length} images)
              </span>
            </h2>
            {galleryImages.length > 0 && (
              <button
                onClick={clearGallery}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            )}
          </div>

          {galleryImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-white/40">
              <Grid3X3 className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-center">No images yet</p>
              <p className="text-sm mt-1">Generated images will appear here</p>
              <button
                onClick={() => setViewMode("chat")}
                className="mt-4 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
              >
                Create Your First Image
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {galleryImages.map((image) => (
                <div
                  key={image.id}
                  className="group relative bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-amber-500/30 transition-all cursor-pointer"
                  onClick={() => setSelectedGalleryImage(image)}
                >
                  <img
                    src={image.imageUrl}
                    alt="Generated content"
                    className="w-full aspect-square object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23333' width='200' height='200'/%3E%3Ctext fill='%23666' x='50%' y='50%' text-anchor='middle' dy='.3em'%3EImage Expired%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-xs line-clamp-2">{image.prompt}</p>
                      <p className="text-white/50 text-xs mt-1">
                        {new Date(image.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromGallery(image.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/50"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Lightbox Modal */}
      {selectedGalleryImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedGalleryImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white/5 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedGalleryImage.imageUrl}
              alt="Generated content"
              className="max-h-[70vh] object-contain"
            />
            <div className="p-4 border-t border-white/10">
              <p className="text-white/80 text-sm mb-2">{selectedGalleryImage.prompt}</p>
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-xs">
                  Created: {new Date(selectedGalleryImage.createdAt).toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <a
                    href={selectedGalleryImage.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 bg-white/10 text-white/80 rounded-lg text-sm hover:bg-white/20 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </a>
                  <a
                    href={selectedGalleryImage.imageUrl}
                    download="restaurant-ai-content.png"
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedGalleryImage(null)}
              className="absolute top-3 right-3 p-2 bg-black/50 rounded-lg hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
