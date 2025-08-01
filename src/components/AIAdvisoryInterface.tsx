import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  MessageSquare,
  Clock,
  CheckCircle2,
  BarChart3,
  Lightbulb,
  Users,
  TrendingUp,
  Send,
  Bot,
  User,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  status?: "sending" | "sent" | "error";
}

interface AnalysisProgress {
  phase: string;
  percentage: number;
  timeRemaining: number;
}

const AIAdvisoryInterface = () => {
  const [currentView, setCurrentView] = useState<"homepage" | "chat">(
    "homepage"
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showIdDialog, setShowIdDialog] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  const [pendingMessage, setPendingMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [analysisProgress, setAnalysisProgress] =
    useState<AnalysisProgress | null>(null);
  const { toast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentView === "chat" && messages.length === 0) {
      // Add welcome message when entering chat
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        content:
          "Welcome to AI Advisory! I'm here to provide comprehensive business insights and analysis. To get started, I'll need your Company ID and User ID. You can include them in your message, or I'll help you add them when needed.",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [currentView]);

  const extractIds = (message: string) => {
    const companyIdMatch =
      message.match(/company[-_\s]id\s*:?\s*([a-zA-Z0-9-_]+)/i) ||
      message.match(/comp[-_\s]id\s*:?\s*([a-zA-Z0-9-_]+)/i);
    const userIdMatch = message.match(/user[-_\s]id\s*:?\s*([a-zA-Z0-9-_]+)/i);

    return {
      companyId: companyIdMatch ? companyIdMatch[1] : null,
      userId: userIdMatch ? userIdMatch[1] : null,
    };
  };

  const startAnalysisProgress = () => {
    const phases = [
      "Analyzing company data...",
      "Processing market insights...",
      "Evaluating competitive landscape...",
      "Generating strategic recommendations...",
      "Finalizing comprehensive report...",
    ];

    let currentPhaseIndex = 0;
    let progress = 0;
    const totalTime = 7 * 60; // 7 minutes in seconds

    setAnalysisProgress({
      phase: phases[0],
      percentage: 0,
      timeRemaining: totalTime,
    });

    const interval = setInterval(() => {
      progress += 1;
      const percentage = Math.min((progress / totalTime) * 100, 100);
      const timeRemaining = Math.max(totalTime - progress, 0);

      // Change phase every ~1.5 minutes
      const phaseIndex = Math.min(
        Math.floor(progress / (totalTime / phases.length)),
        phases.length - 1
      );

      setAnalysisProgress({
        phase: phases[phaseIndex],
        percentage,
        timeRemaining,
      });

      if (progress >= totalTime) {
        clearInterval(interval);
        setAnalysisProgress(null);
      }
    }, 1000);

    return interval;
  };

  const sendToN8n = async (message, companyId, userId, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Attempt ${attempt} - Sending request to n8n workflow...`);

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min timeout

        const response = await fetch(
          "https://n8n.estdev.cloud/webhook/8d5563f9-d123-4b03-8de5-923dce86e6d8",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: `Company ID: ${companyId}, User ID: ${userId}, Message: ${message}`,
            }),
            signal: controller.signal, // Add abort signal
          }
        );

        clearTimeout(timeoutId); // Clear timeout if request succeeds

        if (!response.ok) {
          if (response.status === 502 && attempt < retries) {
            console.log(
              `502 error on attempt ${attempt}, retrying in 3 seconds...`
            );
            await new Promise((resolve) => setTimeout(resolve, 3000));
            continue;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("N8n workflow completed successfully");

        return {
          ...result,
          status: 200,
          completedAt: new Date().toISOString(),
        };
      } catch (err) {
        if (err.name === "AbortError") {
          console.log(`Request timed out on attempt ${attempt}`);
        }

        if (attempt === retries) {
          console.error("All retry attempts failed:", err);
          throw err;
        }
        console.log(`Attempt ${attempt} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const messageText = inputMessage.trim();
    const extractedIds = extractIds(messageText);

    // Check if we have both IDs - only show popup if either is missing
    const missingCompanyId = !extractedIds.companyId;
    const missingUserId = !extractedIds.userId;

    if (missingCompanyId || missingUserId) {
      setPendingMessage(messageText);
      setShowIdDialog(true);
      return;
    }

    await processMessage(
      messageText,
      extractedIds.companyId,
      extractedIds.userId
    );
  };

  const processMessage = async (
    messageText: string,
    companyIdVal: string,
    userIdVal: string
  ) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      sender: "user",
      timestamp: new Date(),
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
    setIsTyping(true);

    // Start progress tracking
    const progressInterval = startAnalysisProgress();

    try {
      // Update user message to sent
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, status: "sent" } : msg
        )
      );

      // Send to n8n
      const response = await sendToN8n(messageText, companyIdVal, userIdVal);

      // Clear progress
      clearInterval(progressInterval);
      setAnalysisProgress(null);
      setIsTyping(false);

      const result = response; // response is a single object, not an array

      const pdfUrl = result?.url;
      const fileName = result?.name;
      const status = result?.status;

      let messageContent;
      if (result?.error === false && status === 200) {
        messageContent = `I've completed the analysis of your request. Your ${fileName} has been generated successfully and is ready for download.`;
      } else {
        messageContent =
          "I've completed the analysis, but there was an issue generating the report.";
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          messageContent +
          (pdfUrl
            ? `<br/><a href="${pdfUrl}" target="_blank" style="color:blue;">📎 Download PDF Report</a>`
            : ""),
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      toast({
        title: "Analysis Complete",
        description: "Your AI advisory report has been generated successfully.",
      });
    } catch (error) {
      clearInterval(progressInterval);
      setAnalysisProgress(null);
      setIsTyping(false);

      // Update user message to error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, status: "error" } : msg
        )
      );

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          "I apologize, but I encountered an issue processing your request. Please try again or contact support if the problem persists.",
        sender: "ai",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: "Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIdSubmit = () => {
    if (!companyId.trim() || !userId.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both Company ID and User ID.",
        variant: "destructive",
      });
      return;
    }

    const enhancedMessage = `${pendingMessage}\n\nCompany ID: ${companyId}\nUser ID: ${userId}`;
    setShowIdDialog(false);
    setPendingMessage("");
    setCompanyId("");
    setUserId("");

    processMessage(enhancedMessage, companyId, userId);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const TypingIndicator = () => (
    <div className="chat-bubble-ai">
      <div className="typing-indicator">
        <div
          className="typing-dot"
          style={{ "--delay": 0 } as React.CSSProperties}
        ></div>
        <div
          className="typing-dot"
          style={{ "--delay": 1 } as React.CSSProperties}
        ></div>
        <div
          className="typing-dot"
          style={{ "--delay": 2 } as React.CSSProperties}
        ></div>
      </div>
    </div>
  );

  if (currentView === "homepage") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-lightest via-background to-primary-lightest">
        {/* Header */}
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary rounded-lg">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
                AI Advisory
              </h1>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto text-center max-w-4xl">
            <div className="animate-fade-in">
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-primary-light bg-clip-text text-transparent">
                Get AI-Powered Advisory Insights for Your Business
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Transform your business strategy with comprehensive AI analysis.
                Get deep insights, market intelligence, and actionable
                recommendations tailored to your company.
              </p>
              <Button
                size="lg"
                className="gradient-hero text-lg px-8 py-6 shadow-elegant hover:shadow-soft transition-smooth"
                onClick={() => setCurrentView("chat")}
              >
                Start Analysis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12 animate-slide-up">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                AI-Powered Business Intelligence
              </h2>
              <p className="text-muted-foreground text-lg">
                Comprehensive analysis across all aspects of your business
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: BarChart3,
                  title: "Market Analysis",
                  description:
                    "Deep dive into market trends, opportunities, and competitive landscape",
                },
                {
                  icon: TrendingUp,
                  title: "Growth Strategy",
                  description:
                    "Identify growth opportunities and strategic recommendations",
                },
                {
                  icon: Users,
                  title: "Customer Insights",
                  description:
                    "Understand your customer base and market positioning",
                },
                {
                  icon: Lightbulb,
                  title: "Innovation Opportunities",
                  description:
                    "Discover new market opportunities and innovation paths",
                },
              ].map((feature, index) => (
                <Card
                  key={index}
                  className="p-6 gradient-card border-0 shadow-soft hover:shadow-elegant transition-smooth animate-scale-in"
                >
                  <div className="p-3 bg-primary-lightest rounded-lg w-fit mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 px-4 bg-secondary/30">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                How It Works
              </h2>
              <p className="text-muted-foreground text-lg">
                Simple process, powerful insights
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: "Provide Your Details",
                  description:
                    "Share your Company ID and User ID for personalized analysis",
                  icon: Users,
                },
                {
                  step: "2",
                  title: "AI Analysis",
                  description:
                    "Our AI conducts thorough analysis in just 5-8 minutes",
                  icon: Brain,
                },
                {
                  step: "3",
                  title: "Get Insights",
                  description:
                    "Receive comprehensive insights delivered while you wait",
                  icon: CheckCircle2,
                },
              ].map((step, index) => (
                <div key={index} className="text-center">
                  <div className="relative mb-6">
                    <div className="w-16 h-16 bg-primary rounded-full mx-auto flex items-center justify-center shadow-soft">
                      <step.icon className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <Badge
                      variant="secondary"
                      className="absolute -top-1 -right-1 w-8 h-8 rounded-full p-0 flex items-center justify-center font-bold"
                    >
                      {step.step}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 p-6 bg-primary-lightest rounded-xl border border-primary-lighter">
              <div className="flex items-center space-x-3 mb-3">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-primary">
                  Deep Analysis Worth the Brief Wait
                </h3>
              </div>
              <p className="text-primary/80">
                Our comprehensive analysis takes 5-8 minutes to ensure thorough
                evaluation of your business data, market conditions, and
                strategic opportunities. The depth of insights justifies the
                brief processing time.
              </p>
            </div>
          </div>
        </section>

        {/* Requirements Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-3xl">
            <Card className="p-8 shadow-elegant border-primary-lighter">
              <div className="text-center mb-6">
                <div className="p-3 bg-primary-lightest rounded-lg w-fit mx-auto mb-4">
                  <AlertCircle className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  Getting Started Requirements
                </h2>
                <p className="text-muted-foreground">
                  To provide accurate and personalized insights, we need the
                  following information:
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start space-x-4 p-4 bg-secondary rounded-lg">
                  <Badge variant="outline" className="mt-1">
                    Required
                  </Badge>
                  <div>
                    <h3 className="font-semibold mb-1">Company ID</h3>
                    <p className="text-muted-foreground text-sm">
                      Your unique company identifier for accessing business data
                      and context.
                      <br />
                      <span className="text-xs italic">
                        Example format: COMP-2024-ABC123 or similar alphanumeric
                        code
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 p-4 bg-secondary rounded-lg">
                  <Badge variant="outline" className="mt-1">
                    Required
                  </Badge>
                  <div>
                    <h3 className="font-semibold mb-1">User ID</h3>
                    <p className="text-muted-foreground text-sm">
                      Your user identifier for personalized recommendations and
                      access control.
                      <br />
                      <span className="text-xs italic">
                        Example format: USER-123456 or your assigned user code
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center">
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => setCurrentView("chat")}
                >
                  Get Insights Now
                  <MessageSquare className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Chat Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={() => setCurrentView("homepage")}
              className="px-2"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary rounded-lg">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-semibold">AI Advisory Assistant</h1>
                <p className="text-xs text-muted-foreground">
                  Professional Business Intelligence
                </p>
              </div>
            </div>
          </div>
          {analysisProgress && (
            <Badge variant="secondary" className="hidden sm:flex">
              <Clock className="h-3 w-3 mr-1" />
              {formatTime(analysisProgress.timeRemaining)} remaining
            </Badge>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      {analysisProgress && (
        <div className="border-b border-border bg-card p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {analysisProgress.phase}
              </span>
              <span className="text-muted-foreground">
                {Math.round(analysisProgress.percentage)}%
              </span>
            </div>
            <Progress value={analysisProgress.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Estimated time remaining:{" "}
              {formatTime(analysisProgress.timeRemaining)}
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="animate-fade-in">
            <div
              className={`flex items-start space-x-3 ${
                message.sender === "user"
                  ? "flex-row-reverse space-x-reverse"
                  : ""
              }`}
            >
              <div
                className={`p-2 rounded-full ${
                  message.sender === "user" ? "bg-primary" : "bg-secondary"
                }`}
              >
                {message.sender === "user" ? (
                  <User className="h-4 w-4 text-primary-foreground" />
                ) : (
                  <Bot className="h-4 w-4 text-secondary-foreground" />
                )}
              </div>
              <div
                className={
                  message.sender === "user"
                    ? "chat-bubble-user"
                    : "chat-bubble-ai"
                }
              >
                {message.sender === "ai" ? (
                  <div
                    className="whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: message.content }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}

                <div
                  className={`flex items-center justify-between mt-2 text-xs ${
                    message.sender === "user"
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  <span>{message.timestamp.toLocaleTimeString()}</span>
                  {message.sender === "user" && message.status && (
                    <span
                      className={`ml-2 ${
                        message.status === "error" ? "text-destructive" : ""
                      }`}
                    >
                      {message.status === "sending" && "●"}
                      {message.status === "sent" && "✓"}
                      {message.status === "error" && "✗"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="animate-fade-in">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-full bg-secondary">
                <Bot className="h-4 w-4 text-secondary-foreground" />
              </div>
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="flex space-x-2">
          <Textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask me about your business strategy, market analysis, or growth opportunities..."
            className="flex-1 min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="self-end"
            size="lg"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Include your Company ID and User ID in your message for personalized
          analysis
        </p>
      </div>

      {/* ID Collection Dialog */}
      <Dialog open={showIdDialog} onOpenChange={setShowIdDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              <span>Required Information</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              To provide accurate analysis, please provide your Company ID and
              User ID:
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="company-id">Company ID</Label>
                <Input
                  id="company-id"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  placeholder="e.g., COMP-2024-ABC123"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="user-id">User ID</Label>
                <Input
                  id="user-id"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="e.g., USER-123456"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowIdDialog(false);
                  setPendingMessage("");
                  setCompanyId("");
                  setUserId("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleIdSubmit}
                disabled={!companyId.trim() || !userId.trim()}
              >
                Add to Message
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIAdvisoryInterface;
