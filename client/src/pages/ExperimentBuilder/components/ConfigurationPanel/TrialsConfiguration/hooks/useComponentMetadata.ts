import { useState, useEffect } from "react";
const API_URL = import.meta.env.VITE_API_URL;

type ComponentParameter = {
  type: string;
  default?: any;
  pretty_name?: string;
  description?: string;
};

export type ComponentMetadata = {
  name: string;
  version: string;
  parameters: Record<string, ComponentParameter>;
  data?: Record<string, any>;
};

export const useComponentMetadata = (componentType: string | null) => {
  const [metadata, setMetadata] = useState<ComponentMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!componentType) {
      setMetadata(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Convert ComponentType to kebab-case filename
    // e.g., "ImageComponent" -> "image-component"
    const fileName = componentType
      .replace(/Component$/, "")
      .replace(/([A-Z])/g, "-$1")
      .toLowerCase()
      .replace(/^-/, "");

    fetch(`${API_URL}/api/component-metadata/${fileName}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load metadata for ${componentType}`);
        }
        return res.json();
      })
      .then((data) => {
        setMetadata(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading component metadata:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [componentType]);

  return { metadata, loading, error };
};
