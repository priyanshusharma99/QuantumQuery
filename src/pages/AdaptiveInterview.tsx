import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, Send, LogOut, Mic, MicOff, Volume2, VolumeX, 
  Sparkles, CheckCircle2, Circle, Brain, Zap, Clock, Target 
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { ThemeToggle } from "@/components/ThemeToggle";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SkillGap {
  skill: string;
  importance: string;
  learning_resource: string;
}

const AdaptiveInterview = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [sessionStartTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState(0);

  const {
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoiceChat({
    onTranscript: (transcript, isFinal) => {
      if (isFinal) {
        setInput(transcript);
        setInterimTranscript("");
      } else {
        setInterimTranscript(transcript);
      }
    },
    onError: (error) => {
      toast({
        title: "Voice Error",
        description: error,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionStartTime]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUserId(user.id);
    await loadCareerGuidance(user.id);
  };

  const loadCareerGuidance = async (userId: string) => {
    try {
      const { data: recommendations, error } = await supabase
        .from("user_career_recommendations")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        toast({
          title: "No Career Guidance Found",
          description: "Please generate career guidance first from the Job Market Insights page.",
          variant: "destructive",
        });
        navigate("/job-market");
        return;
      }

      const gaps = (recommendations.skill_gaps as unknown) as SkillGap[];
      setSkillGaps(gaps || []);
      await sendInitialMessage(gaps || []);
    } catch (error) {
      console.error("Error loading career guidance:", error);
      toast({
        title: "Error",
        description: "Failed to load career guidance",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendInitialMessage = async (gaps: SkillGap[]) => {
    const initialMessages = [
      {
        role: "user" as const,
        content: "Start the adaptive interview simulation based on my skill gaps.",
      },
    ];

    setMessages(initialMessages);
    await streamResponse(initialMessages, gaps);
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setInterimTranscript("");

    await streamResponse(updatedMessages, skillGaps);
  };

  const streamResponse = async (msgs: Message[], gaps: SkillGap[]) => {
    setIsStreaming(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "adaptive-interview-chat",
        {
          body: { messages: msgs, userId, skillGaps: gaps },
        }
      );

      if (error) throw error;

      const reader = data.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = "";

      const assistantMessage: Message = {
        role: "assistant",
        content: "",
      };

      setMessages([...msgs, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || "";
              if (content) {
                accumulatedResponse += content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: "assistant",
                    content: accumulatedResponse,
                  };
                  return newMessages;
                });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      if (voiceMode && accumulatedResponse) {
        speak(accumulatedResponse);
      }
    } catch (error) {
      console.error("Streaming error:", error);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const toggleVoiceMode = () => {
    const newMode = !voiceMode;
    setVoiceMode(newMode);
    
    if (newMode) {
      toast({
        title: "Voice Mode Enabled",
        description: "Click the microphone to start speaking",
      });
    } else {
      stopListening();
      stopSpeaking();
      toast({
        title: "Voice Mode Disabled",
        description: "Switched to text mode",
      });
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getImportanceColor = (importance: string) => {
    switch (importance.toLowerCase()) {
      case 'high':
        return 'from-red-500 to-orange-500';
      case 'medium':
        return 'from-yellow-500 to-amber-500';
      case 'low':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-violet-500 to-purple-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
          <p className="text-muted-foreground animate-pulse">Preparing your adaptive interview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-border/40 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <img src="/voke-logo.png" alt="Voke" className="w-8 h-8" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
              Adaptive Interview
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{formatTime(elapsedTime)}</span>
            </div>
            <ThemeToggle />
            <Button
              variant={voiceMode ? "default" : "outline"}
              size="sm"
              onClick={toggleVoiceMode}
              className="gap-2"
            >
              {voiceMode ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {voiceMode ? "Voice On" : "Voice Off"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Skill Gaps Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-card/30 backdrop-blur-xl border-border/50 sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-500" />
                  Focus Areas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {skillGaps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No skill gaps identified</p>
                ) : (
                  skillGaps.map((gap, index) => {
                    const getBorderColor = (importance: string) => {
                      switch (importance.toLowerCase()) {
                        case 'high':
                          return 'border-l-red-500';
                        case 'medium':
                          return 'border-l-yellow-500';
                        case 'low':
                          return 'border-l-blue-500';
                        default:
                          return 'border-l-violet-500';
                      }
                    };
                    
                    const getTextColor = (importance: string) => {
                      switch (importance.toLowerCase()) {
                        case 'high':
                          return 'text-red-500';
                        case 'medium':
                          return 'text-yellow-500';
                        case 'low':
                          return 'text-blue-500';
                        default:
                          return 'text-violet-500';
                      }
                    };
                    
                    return (
                      <div
                        key={index}
                        className={`group p-3 rounded-lg border border-border/50 hover:border-violet-500/50 transition-all cursor-pointer hover:shadow-md border-l-4 ${getBorderColor(gap.importance)}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-sm group-hover:text-violet-500 transition-colors flex-1">
                            {gap.skill}
                          </h4>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getTextColor(gap.importance)} border-current`}
                          >
                            {gap.importance}
                          </Badge>
                        </div>
                        <Progress value={Math.random() * 40 + 20} className="h-1.5" />
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <Card className="bg-card/30 backdrop-blur-xl border-border/50 flex flex-col h-[calc(100vh-12rem)]">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-violet-500/5 to-purple-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg ${isSpeaking ? 'animate-pulse' : ''}`}>
                        <Brain className="w-6 h-6 text-white" />
                      </div>
                      {isSpeaking && (
                        <div className="absolute inset-0 rounded-full bg-violet-500/30 animate-ping"></div>
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">AI Interviewer</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {isStreaming ? "Thinking..." : isSpeaking ? "Speaking..." : "Ready to chat"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-violet-500/10 text-violet-500 border-violet-500/20">
                    {messages.length} messages
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-4 duration-300`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-md ${
                          message.role === "user"
                            ? "bg-gradient-to-br from-violet-600 to-purple-600 text-white"
                            : "bg-card border border-border/50"
                        }`}
                      >
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isStreaming && (
                    <div className="flex justify-start animate-in slide-in-from-bottom-4 duration-300">
                      <div className="bg-card border border-border/50 rounded-2xl px-5 py-3 shadow-md">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-xs text-muted-foreground">AI is typing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t border-border/50 p-4 bg-muted/20">
                  {voiceMode && (
                    <div className="mb-4 flex items-center gap-3">
                      <Button
                        type="button"
                        size="lg"
                        variant={isListening ? "destructive" : "default"}
                        onClick={toggleListening}
                        disabled={isStreaming || isSpeaking}
                        className={`gap-2 ${isListening ? 'animate-pulse' : ''}`}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="h-5 w-5" />
                            Stop Recording
                          </>
                        ) : (
                          <>
                            <Mic className="h-5 w-5" />
                            Start Recording
                          </>
                        )}
                      </Button>
                      {isListening && (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                              <div
                                key={i}
                                className="w-1 bg-violet-500 rounded-full animate-pulse"
                                style={{
                                  height: `${Math.random() * 20 + 10}px`,
                                  animationDelay: `${i * 100}ms`
                                }}
                              ></div>
                            ))}
                          </div>
                          <Badge variant="secondary" className="bg-violet-500/10 text-violet-500 border-violet-500/20 animate-pulse">
                            Listening...
                          </Badge>
                        </div>
                      )}
                      {isSpeaking && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 animate-pulse">
                          AI Speaking...
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {interimTranscript && (
                    <div className="mb-3 p-3 bg-violet-500/10 rounded-lg border border-violet-500/20">
                      <p className="text-sm text-violet-500 italic">
                        {interimTranscript}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type your response or use voice mode..."
                      className="min-h-[80px] resize-none border-border/50 focus:border-violet-500 transition-colors"
                      disabled={isStreaming || isListening}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || isStreaming}
                      size="lg"
                      className="px-8 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg transition-all hover:scale-105"
                    >
                      {isStreaming ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdaptiveInterview;
