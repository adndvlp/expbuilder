import React, { useState, useRef, useEffect } from "react";
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaAlignJustify,
  FaListUl,
  FaListOl,
  FaLink,
  FaUndo,
  FaRedo,
  FaCode,
  FaFont,
  FaCopy,
  FaCut,
  FaPaste,
  FaIndent,
  FaOutdent,
  FaSuperscript,
  FaSubscript,
  FaHighlighter,
} from "react-icons/fa";

interface HtmlMapperProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

const HtmlMapper: React.FC<HtmlMapperProps> = ({ value, onChange, label }) => {
  const [isSourceView, setIsSourceView] = useState(false);
  const [sourceCode, setSourceCode] = useState(value);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && !isSourceView) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
      editorRef.current.focus();
    }
    setSourceCode(value);
  }, [value, isSourceView]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setSourceCode(newValue);
    onChange(newValue);
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      execCommand("createLink", url);
    }
  };

  const insertImage = () => {
    const url = prompt("Enter image URL:");
    if (url) {
      execCommand("insertImage", url);
    }
  };

  const changeFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    execCommand("fontSize", e.target.value);
  };

  const changeFontFamily = (e: React.ChangeEvent<HTMLSelectElement>) => {
    execCommand("fontName", e.target.value);
  };

  const changeTextColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    execCommand("foreColor", e.target.value);
  };

  const changeBackgroundColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    execCommand("hiliteColor", e.target.value);
  };

  const formatBlock = (e: React.ChangeEvent<HTMLSelectElement>) => {
    execCommand("formatBlock", e.target.value);
  };

  return (
    <div className="html-mapper-container">
      {label && (
        <label className="block mb-3 text-base font-semibold tracking-wide">
          {label}
        </label>
      )}

      <div className="word-editor-container">
        {/* Header con tabs */}
        <div className="word-header">
          <div className="word-tabs">
            <button
              type="button"
              onClick={() => {
                setIsSourceView(false);
              }}
              className={`word-tab ${!isSourceView ? "word-tab-active" : ""}`}
            >
              <FaFont className="inline mr-1" /> Home
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSourceView(true);
              }}
              className={`word-tab ${isSourceView ? "word-tab-active" : ""}`}
            >
              <FaCode className="inline mr-1" /> HTML
            </button>
          </div>
        </div>

        {/* Ribbon Toolbar - estilo Word */}
        {!isSourceView && (
          <div className="word-ribbon">
            {/* Portapapeles */}
            <div className="ribbon-group">
              <div className="ribbon-group-header">Clipboard</div>
              <div className="ribbon-group-content">
                <div className="ribbon-large-buttons">
                  <button className="ribbon-large-btn" title="Paste">
                    <FaPaste className="text-xl" />
                    <span>Paste</span>
                  </button>
                </div>
                <div className="ribbon-small-buttons">
                  <button
                    className="ribbon-small-btn"
                    title="Cut"
                    onClick={() => execCommand("cut")}
                  >
                    <FaCut />
                    <span>Cut</span>
                  </button>
                  <button
                    className="ribbon-small-btn"
                    title="Copy"
                    onClick={() => execCommand("copy")}
                  >
                    <FaCopy />
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="ribbon-separator" />

            {/* Fuente */}
            <div className="ribbon-group">
              <div className="ribbon-group-header">Font</div>
              <div className="ribbon-group-content">
                <div className="ribbon-font-controls">
                  <select
                    onChange={changeFontFamily}
                    className="font-selector"
                    defaultValue=""
                  >
                    <option value="">Calibri</option>
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Helvetica">Helvetica</option>
                  </select>
                  <select
                    onChange={changeFontSize}
                    className="size-selector"
                    defaultValue=""
                  >
                    <option value="">11</option>
                    <option value="1">8</option>
                    <option value="2">10</option>
                    <option value="3">12</option>
                    <option value="4">14</option>
                    <option value="5">18</option>
                    <option value="6">24</option>
                    <option value="7">36</option>
                  </select>
                </div>
                <div className="ribbon-format-buttons">
                  <button
                    onClick={() => execCommand("bold")}
                    className="ribbon-format-btn"
                    title="Bold"
                  >
                    <FaBold />
                  </button>
                  <button
                    onClick={() => execCommand("italic")}
                    className="ribbon-format-btn"
                    title="Italic"
                  >
                    <FaItalic />
                  </button>
                  <button
                    onClick={() => execCommand("underline")}
                    className="ribbon-format-btn"
                    title="Underlined"
                  >
                    <FaUnderline />
                  </button>
                  <button
                    onClick={() => execCommand("strikeThrough")}
                    className="ribbon-format-btn"
                    title="Crossed Out"
                  >
                    <FaStrikethrough />
                  </button>
                  <button
                    onClick={() => execCommand("subscript")}
                    className="ribbon-format-btn"
                    title="Subscript"
                  >
                    <FaSubscript />
                  </button>
                  <button
                    onClick={() => execCommand("superscript")}
                    className="ribbon-format-btn"
                    title="Superscript"
                  >
                    <FaSuperscript />
                  </button>
                </div>
                <div className="ribbon-color-controls">
                  <div className="color-picker-wrapper color-horizontal">
                    <FaFont title="Text Color" className="color-icon" />
                    <input
                      type="color"
                      onChange={changeTextColor}
                      className="color-picker"
                      title="Text Color"
                    />
                  </div>
                  <div className="color-picker-wrapper color-horizontal">
                    <FaHighlighter
                      title="Highlight Color"
                      className="color-icon"
                    />
                    <input
                      type="color"
                      onChange={changeBackgroundColor}
                      className="color-picker"
                      title="Highlight Color"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="ribbon-separator" />

            {/* Párrafo */}
            <div className="ribbon-group">
              <div className="ribbon-group-header">Paragraph</div>
              <div className="ribbon-group-content">
                <div className="ribbon-paragraph-row">
                  <button
                    onClick={() => execCommand("insertUnorderedList")}
                    className="ribbon-format-btn"
                    title="Bullets"
                  >
                    <FaListUl />
                  </button>
                  <button
                    onClick={() => execCommand("insertOrderedList")}
                    className="ribbon-format-btn"
                    title="Numbering"
                  >
                    <FaListOl />
                  </button>
                  <button
                    onClick={() => execCommand("outdent")}
                    className="ribbon-format-btn"
                    title="Decrease Indent"
                  >
                    <FaOutdent />
                  </button>
                  <button
                    onClick={() => execCommand("indent")}
                    className="ribbon-format-btn"
                    title="Increase Indent"
                  >
                    <FaIndent />
                  </button>
                </div>
                <div className="ribbon-paragraph-row">
                  <button
                    onClick={() => execCommand("justifyLeft")}
                    className="ribbon-format-btn"
                    title="Align Left"
                  >
                    <FaAlignLeft />
                  </button>
                  <button
                    onClick={() => execCommand("justifyCenter")}
                    className="ribbon-format-btn"
                    title="Center"
                  >
                    <FaAlignCenter />
                  </button>
                  <button
                    onClick={() => execCommand("justifyRight")}
                    className="ribbon-format-btn"
                    title="Align Right"
                  >
                    <FaAlignRight />
                  </button>
                  <button
                    onClick={() => execCommand("justifyFull")}
                    className="ribbon-format-btn"
                    title="Justify"
                  >
                    <FaAlignJustify />
                  </button>
                </div>
              </div>
            </div>

            <div className="ribbon-separator" />

            {/* Styles */}
            <div className="ribbon-group">
              <div className="ribbon-group-header">Styles</div>
              <div className="ribbon-group-content">
                <select
                  onChange={formatBlock}
                  className="style-selector"
                  defaultValue=""
                >
                  <option value="p">Normal</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                  <option value="h4">Heading 4</option>
                  <option value="h5">Heading 5</option>
                  <option value="h6">Heading 6</option>
                </select>
              </div>
            </div>

            <div className="ribbon-separator" />

            {/* Insert */}
            <div className="ribbon-group">
              <div className="ribbon-group-header">Insert</div>
              <div className="ribbon-group-content">
                <button
                  onClick={insertLink}
                  className="ribbon-insert-btn"
                  title="Hyperlink"
                >
                  <FaLink />
                  <span>Link</span>
                </button>
                <button
                  onClick={insertImage}
                  className="ribbon-insert-btn"
                  title="Image"
                >
                  🖼️
                  <span>Image</span>
                </button>
              </div>
            </div>

            <div className="ribbon-separator" />

            {/* Editing */}
            <div className="ribbon-group">
              <div className="ribbon-group-header">Editing</div>
              <div className="ribbon-group-content">
                <button
                  onClick={() => execCommand("undo")}
                  className="ribbon-insert-btn"
                  title="Undo"
                >
                  <FaUndo />
                  <span>Undo</span>
                </button>
                <button
                  onClick={() => execCommand("redo")}
                  className="ribbon-insert-btn"
                  title="Redo"
                >
                  <FaRedo />
                  <span>Redo</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editor Area */}
        <div className="word-editor-area">
          {isSourceView ? (
            <textarea
              value={sourceCode}
              onChange={handleSourceChange}
              className="word-source-editor"
              placeholder="Enter HTML code..."
            />
          ) : (
            <div className="word-document">
              <div className="word-page">
                <div
                  ref={editorRef}
                  contentEditable
                  className="word-content"
                  onInput={handleInput}
                  suppressContentEditableWarning={true}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Estilos CSS usando variables de la app */}
      <style>{`
        .word-editor-container {
          border: 1px solid var(--neutral-mid);
          border-radius: 8px;
          background: var(--neutral-light);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .word-header {
          position: sticky;
          top: 0;
          background: var(--primary-blue);
          color: var(--text-light);
          padding: 0;
        }

        .word-tabs {
          display: flex;
          padding: 4px 8px 0;
        }

        .word-tab {
          padding: 8px 16px;
          background: transparent;
          border: none;
          color: var(--text-light);
          border-radius: 4px 4px 0 0;
          margin-right: 2px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
          opacity: 0.8;
        }

        .word-tab:hover {
          background: rgba(255,255,255,0.1);
          opacity: 1;
        }

        .word-tab-active {
          background: var(--neutral-light) !important;
          color: var(--text-dark) !important;
          opacity: 1 !important;
        }

        .word-ribbon {
          position: sticky;
          top: 38px;
          background: var(--neutral-light);
          border-bottom: 1px solid var(--neutral-mid);
          padding: 12px 16px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .ribbon-group {
          display: flex;
          flex-direction: column;
          min-width: 80px;
        }

        .ribbon-group-header {
          font-size: 11px;
          color: var(--text-dark);
          margin-bottom: 4px;
          text-align: center;
          font-weight: 500;
          opacity: 0.7;
        }

        .ribbon-group-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ribbon-separator {
          width: 1px;
          background: var(--neutral-mid);
          height: 60px;
          margin: 0 4px;
        }

        .ribbon-large-buttons {
          display: flex;
          gap: 4px;
        }

        .ribbon-large-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 12px;
          background: var(--neutral-light);
          border: 1px solid var(--neutral-mid);
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          gap: 4px;
          transition: all 0.2s;
          min-width: 60px;
          color: var(--text-dark);
        }

        .ribbon-large-btn:hover {
          background: var(--light-blue);
          color: var(--text-light);
          border-color: var(--primary-blue);
        }

        .ribbon-small-buttons {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ribbon-small-btn {
          display: flex;
          align-items: center;
          padding: 3px 8px;
          background: var(--neutral-light);
          border: 1px solid var(--neutral-mid);
          border-radius: 3px;
          cursor: pointer;
          font-size: 10px;
          gap: 4px;
          transition: all 0.2s;
          color: var(--text-dark);
        }

        .ribbon-small-btn:hover {
          background: var(--light-blue);
          color: var(--text-light);
          border-color: var(--primary-blue);
        }

        .ribbon-font-controls {
          display: flex;
          gap: 4px;
          margin-bottom: 4px;
        }

        .font-selector, .size-selector, .style-selector {
          padding: 4px 6px;
          border: 1px solid var(--neutral-mid);
          border-radius: 3px;
          background: var(--neutral-light);
          color: var(--text-dark);
          font-size: 11px;
          cursor: pointer;
        }

        .font-selector {
          width: 120px;
        }

        .size-selector {
          width: 50px;
        }

        .style-selector {
          width: 100px;
        }

        .ribbon-format-buttons {
          display: flex;
          gap: 2px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }

        .ribbon-format-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--neutral-light);
          border: 1px solid var(--neutral-mid);
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.2s;
          color: var(--text-dark);
        }

        .ribbon-format-btn:hover {
          background: var(--primary-blue);
          color: var(--text-light);
          border-color: var(--primary-blue);
        }

        .ribbon-color-controls {
          display: flex;
          gap: 4px;
        }

        .color-picker-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .color-picker-wrapper.color-horizontal {
          flex-direction: row;
          align-items: center;
          gap: 4px;
        }

        @media (prefers-color-scheme: dark) {
          .color-picker-wrapper.color-horizontal svg {
            color: var(--text-light) !important;
          }
        }

        .color-picker {
          width: 20px;
          height: 16px;
          border: 1px solid var(--neutral-mid);
          border-radius: 2px;
          cursor: pointer;
        }

        .ribbon-paragraph-row {
          display: flex;
          gap: 2px;
          margin-bottom: 2px;
        }

        .ribbon-insert-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 6px 8px;
          background: var(--neutral-light);
          border: 1px solid var(--neutral-mid);
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
          gap: 2px;
          transition: all 0.2s;
          min-width: 50px;
          color: var(--text-dark);
        }

        .ribbon-insert-btn:hover {
          background: var(--gold);
          color: var(--text-dark);
          border-color: var(--gold);
        }

        .word-editor-area {
          background: var(--neutral-mid);
          min-height: 500px;
          padding: 20px;
        }

        .word-document {
          display: flex;
          justify-content: center;
        }

        .word-page {
          width: 100%;
          max-width: 8.5in;
          min-height: 11in;
          background: var(--neutral-light);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          margin: 0 auto;
        }

        .word-content {
          padding: 1in;
          min-height: 9in;
          font-family: 'Calibri', 'Arial', sans-serif;
          font-size: 11pt;
          line-height: 1.15;
          color: var(--text-dark);
          outline: none;
        }

        .word-content:focus {
          outline: none;
        }

        .word-preview {
          background: var(--neutral-light);
          padding: 1in;
          min-height: 500px;
          font-family: 'Calibri', 'Arial', sans-serif;
          font-size: 11pt;
          line-height: 1.15;
          color: var(--text-dark);
        }

        .word-source-editor {
          width: 100%;
          height: 500px;
          padding: 20px;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 12px;
          border: none;
          background: var(--neutral-dark);
          color: var(--text-dark);
          resize: none;
          outline: none;
        }

        .color-icon {
          font-size: 16px;
        }
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .word-ribbon {
            flex-direction: column;
            gap: 8px;
          }
          
          .ribbon-separator {
            width: 100%;
            height: 1px;
            margin: 4px 0;
          }
          
          .word-page {
            margin: 0 10px;
          }
          
          .word-content {
            padding: 0.5in;
          }
        }
      `}</style>
    </div>
  );
};

export default HtmlMapper;
