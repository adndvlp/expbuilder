import { useEffect, useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor"; // brings in Monaco’s own types
import useDevMode from "../hooks/useDevMode";

const CodeEditor: React.FC = () => {
  const { code, setCode } = useDevMode();
  const [saveIndicator, setSaveIndicator] = useState(false);
  // ──────────────────────────────────────────────
  // 1.  Give the ref the right generic type
  //    (IStandaloneCodeEditor | null, never plain `null`)
  // ──────────────────────────────────────────────
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ──────────────────────────────────────────────
  // 2.  onMount gets an editor instance + the Monaco namespace.
  //     Typing it with OnMount removes the “implicitly‑any” errors.
  // ──────────────────────────────────────────────
  const handleEditorDidMount: OnMount = (editor, _monaco) => {
    editorRef.current = editor;

    // Configurar los comandos de undo/redo
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
      editor.trigger("keyboard", "undo", null);
    });

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
      () => {
        editor.trigger("keyboard", "redo", null);
      }
    );

    editor.onDidChangeModelContent(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (editorRef.current) {
          const newCode = editorRef.current.getValue();
          setCode(newCode);

          setSaveIndicator(true);
          setTimeout(() => {
            setSaveIndicator(false);
          }, 2000);
        }
      }, 1000);
    });
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // ──────────────────────────────────────────────
  // 3.  Always null‑check the ref before using it.
  // ──────────────────────────────────────────────
  // const showValue = () => {
  //   if (editorRef.current) {
  //     alert("Code Saved");
  //     setCode(editorRef.current.getValue());
  //     console.log(code);
  //   }
  // };

  return (
    <>
      {/* Indicador de guardado */}
      <div
        id="plugin-save-indicator"
        style={{
          opacity: saveIndicator ? 1 : 0,
          transition: "opacity 0.3s",
          color: "green",
          marginTop: 0,
          textAlign: "center",
        }}
      >
        Saved Code
      </div>

      <Editor
        value={code}
        height="100vh"
        defaultLanguage="javascript"
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          // Agregar opciones para mejorar la experiencia
          automaticLayout: true,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          cursorStyle: "line",
          wordWrap: "off",
          tabSize: 2,
          fontSize: 14,
          // Habilitar undo/redo
          lineNumbers: "on",
          folding: true,
          bracketPairColorization: {
            enabled: true,
          },
          colorDecorators: true,
          suggest: {
            showKeywords: true,
            showSnippets: true,
            showFunctions: true,
            showConstants: true,
            showVariables: true,
          },
          quickSuggestions: {
            other: true,
            comments: true,
            strings: true,
          },
          // Configuración adicional para JavaScript
          tabCompletion: "on",
          acceptSuggestionOnEnter: "on",
          snippetSuggestions: "top",
        }}
      />
    </>
  );
};

export default CodeEditor;
