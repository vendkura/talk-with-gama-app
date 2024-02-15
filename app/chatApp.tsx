"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useChat } from "ai/react";
import {
  ArrowDown,
  RefreshCcw,
  RefreshCcwDot,
  Send,
  Square,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Toaster, toast } from "sonner";

export const ChatApp = () => {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    reload,
    stop,
    setMessages,
    isLoading,
  } = useChat({
    api: "/api/chat",
    initialMessages: [],
    onError: () => {
      toast.error(
        "Too Many requests, Only 50 requests are allowed in 10 minutes."
      );
    },
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const isEmptyMessages = messages.length === 0;
  const ulRef = useRef<HTMLUListElement>(null);

  // Pas recommandé
  useEffect(() => {
    const ul = ulRef.current;
    if (!ul) return;
    if (!autoScroll) return;

    const { scrollHeight, clientHeight } = ul;

    ul.scrollTop = scrollHeight - clientHeight;
  }, [autoScroll, messages]);

  useEffect(() => {
    // add event listener to scroll of ulRef if defined

    const ul = ulRef.current;

    if (!ul) return;

    const handleScroll = () => {
      const { scrollHeight, clientHeight, scrollTop } = ul;

      if (scrollHeight - clientHeight - scrollTop <= 1) {
        setAutoScroll(true);
      } else {
        setAutoScroll(false);
      }
    };

    ul.addEventListener("scroll", handleScroll);

    return () => {
      ul.removeEventListener("scroll", handleScroll);
    };
  }, [messages.length]);

  //-------------

  return (
    <div className="h-full py-4 flex flex-col gap-4  justify-center">
      <Toaster richColors position="top-right" />
      <header className="flex item-center gap-4">
        <Image
          src="/Images/gama-logo.png"
          width="50"
          height="50"
          alt="Nextjs logo"
          className={cn({
            "w-12 h-12": isEmptyMessages,
          })}
        />
        <h1
          className={cn("text-lg font-bold", {
            "text-2xl ": isEmptyMessages,
          })}
        >
          Talk with Gama Documentation
        </h1>
      </header>
      {messages.length > 0 && (
        <ul className="flex-1 overflow-auto gap-4 flex flex-col" ref={ulRef}>
          {messages.map((m, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <Avatar className="h-6 w-6 ">
                  <AvatarFallback>
                    {m.role === "user" ? "U" : "A"}
                  </AvatarFallback>
                  {m.role === "assistant" && (
                    <AvatarImage src="/Images/gama-logo.png" alt="Gama logo" />
                  )}
                </Avatar>
                <CardTitle>
                  <span className="font-bold">{m.role}</span> Said:
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown className="prose">{m.content}</Markdown>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
      {messages.length >= 1 ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={isLoading}
            onClick={() => {
              setMessages([]);
              stop();
            }}
          >
            <RefreshCcwDot size={16} />
            Reset
          </Button>

          <Button disabled={isLoading} onClick={() => reload()}>
            <RefreshCcw size={16} /> Reload
          </Button>

          <Button size="sm" disabled={!isLoading} onClick={() => stop()}>
            <Square size={16} className="mr-2" />
            Stop
          </Button>
          {!autoScroll ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAutoScroll(true);
              }}
            >
              <ArrowDown size={16} className="mr-2" />
              Scroll
            </Button>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 w-full">
        <Label className="flex-1">
          Say something...
          <Textarea value={input} onChange={handleInputChange} />
        </Label>
        <Button type="submit" size="sm">
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
};
