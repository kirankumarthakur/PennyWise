import React, { createContext, useContext, useState, useEffect } from "react";
import { getAiCredentials, setAiCredentials, clearAiCredentials } from "../config/api";

const AiKeyContext = createContext(null);

export function AiKeyProvider({ children }) {
  const [credentials, setCredentials] = useState(() => getAiCredentials());

  useEffect(() => {
    const handleUpdate = (e) => {
      setCredentials({ ...e.detail });
    };
    window.addEventListener("aiCredentialsUpdated", handleUpdate);
    return () => window.removeEventListener("aiCredentialsUpdated", handleUpdate);
  }, []);

  const updateKey = (key) => {
    setAiCredentials({ apiKey: key });
  };

  const updateProvider = (p) => {
    setAiCredentials({ provider: p });
  };

  const updateModel = (m) => {
    setAiCredentials({ model: m });
  };

  const removeKey = () => {
    clearAiCredentials();
  };

  const value = {
    apiKey: credentials.apiKey,
    provider: credentials.provider,
    model: credentials.model,
    hasKey: Boolean(credentials.apiKey && credentials.apiKey.trim().length > 0),
    setApiKey: updateKey,
    setProvider: updateProvider,
    setModel: updateModel,
    removeKey,
  };

  return <AiKeyContext.Provider value={value}>{children}</AiKeyContext.Provider>;
}

export function useAiKey() {
  const context = useContext(AiKeyContext);
  if (!context) {
    throw new Error("useAiKey must be used within an AiKeyProvider");
  }
  return context;
}
