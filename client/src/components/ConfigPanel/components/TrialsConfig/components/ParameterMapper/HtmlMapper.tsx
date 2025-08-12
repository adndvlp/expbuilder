import React, { useState, useRef, useEffect } from "react";
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaListUl,
  FaListOl,
  FaLink,
  FaUndo,
  FaRedo,
  FaEye,
  FaCode,
  FaFont,
} from "react-icons/fa";

interface HtmlMapperProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

const HtmlMapper: React.FC<HtmlMapperProps> = ({ value, onChange, label }) => {
  const [isPreview, setIsPreview] = useState(false);
  const [isSourceView, setIsSourceView] = useState(false);
  const [sourceCode, setSourceCode] = useState(value);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && !isPreview && !isSourceView) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    setSourceCode(value);
  }, [value, isPreview, isSourceView]);

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
        <label className="block mb-3 text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        {/* Mode Toggle */}
        <div className="bg-gray-50 px-4 py-2 border-b flex gap-1">
          <button
            type="button"
            onClick={() => {
              setIsPreview(false);
              setIsSourceView(false);
            }}
            className={`px-3 py-1 text-sm rounded ${
              !isPreview && !isSourceView
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <FaFont className="inline mr-1" /> Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPreview(true);
              setIsSourceView(false);
            }}
            className={`px-3 py-1 text-sm rounded ${
              isPreview
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <FaEye className="inline mr-1" /> Preview
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPreview(false);
              setIsSourceView(true);
            }}
            className={`px-3 py-1 text-sm rounded ${
              isSourceView
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <FaCode className="inline mr-1" /> Source
          </button>
        </div>

        {/* Toolbar - Solo mostrar en modo Edit */}
        {!isPreview && !isSourceView && (
          <div className="bg-gray-100 p-3 border-b">
            {/* Primera fila */}
            <div className="flex flex-wrap gap-1 mb-2">
              {/* Undo/Redo */}
              <button
                type="button"
                onClick={() => execCommand("undo")}
                className="p-2 hover:bg-gray-200 rounded"
                title="Undo"
              >
                <FaUndo />
              </button>
              <button
                type="button"
                onClick={() => execCommand("redo")}
                className="p-2 hover:bg-gray-200 rounded"
                title="Redo"
              >
                <FaRedo />
              </button>

              <div className="w-px h-8 bg-gray-300 mx-1" />

              {/* Text Formatting */}
              <button
                type="button"
                onClick={() => execCommand("bold")}
                className="p-2 hover:bg-gray-200 rounded font-bold"
                title="Bold"
              >
                <FaBold />
              </button>
              <button
                type="button"
                onClick={() => execCommand("italic")}
                className="p-2 hover:bg-gray-200 rounded"
                title="Italic"
              >
                <FaItalic />
              </button>
              <button
                type="button"
                onClick={() => execCommand("underline")}
                className="p-2 hover:bg-gray-200 rounded"
                title="Underline"
              >
                <FaUnderline />
              </button>
              <button
                type="button"
                onClick={() => execCommand("strikeThrough")}
                className="p-2 hover:bg-gray-200 rounded"
                title="Strike Through"
              >
                <FaStrikethrough />
              </button>

              <div className="w-px h-8 bg-gray-300 mx-1" />

              {/* Colors */}
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-600">Text:</label>
                <input
                  type="color"
                  onChange={changeTextColor}
                  className="w-8 h-8 border rounded cursor-pointer"
                  title="Text Color"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-600">Background:</label>
                <input
                  type="color"
                  onChange={changeBackgroundColor}
                  className="w-8 h-8 border rounded cursor-pointer"
                  title="Background Color"
                />
              </div>
            </div>

            {/* Segunda fila */}
            <div className="flex flex-wrap gap-1 mb-2">
              {/* Font Family */}
              <select
                onChange={changeFontFamily}
                className="px-2 py-1 text-sm border rounded bg-white"
                defaultValue=""
              >
                <option value="">Font Family</option>
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
                <option value="Courier New">Courier New</option>
              </select>

              {/* Font Size */}
              <select
                onChange={changeFontSize}
                className="px-2 py-1 text-sm border rounded bg-white"
                defaultValue=""
              >
                <option value="">Size</option>
                <option value="1">Very Small</option>
                <option value="2">Small</option>
                <option value="3">Normal</option>
                <option value="4">Medium</option>
                <option value="5">Large</option>
                <option value="6">Very Large</option>
                <option value="7">Huge</option>
              </select>

              {/* Format Block */}
              <select
                onChange={formatBlock}
                className="px-2 py-1 text-sm border rounded bg-white"
                defaultValue=""
              >
                <option value="">Format</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="h4">Heading 4</option>
                <option value="h5">Heading 5</option>
                <option value="h6">Heading 6</option>
                <option value="p">Paragraph</option>
                <option value="div">Div</option>
                <option value="pre">Preformatted</option>
              </select>
            </div>

            {/* Tercera fila */}
            <div className="flex flex-wrap gap-1">
              {/* Alignment */}
              <button
                type="button"
                onClick={() => execCommand("justifyLeft")}
                className="p-2 hover:bg-gray-200 rounded"
                title="Align Left"
              >
                <FaAlignLeft />
              </button>
              <button
                type="button"
                onClick={() => execCommand("justifyCenter")}
                className="p-2 hover:bg-gray-200 rounded"
                title="Center"
              >
                <FaAlignCenter />
              </button>
              <button
                type="button"
                onClick={() => execCommand("justifyRight")}
                className="p-2 hover:bg-gray-200 rounded"
                title="Align Right"
              >
                <FaAlignRight />
              </button>

              <div className="w-px h-8 bg-gray-300 mx-1" />

              {/* Lists */}
              <button
                type="button"
                onClick={() => execCommand("insertUnorderedList")}
                className="p-2 hover:bg-gray-200 rounded"
                title="Bullet List"
              >
                <FaListUl />
              </button>
              <button
                type="button"
                onClick={() => execCommand("insertOrderedList")}
                className="p-2 hover:bg-gray-200 rounded"
                title="Numbered List"
              >
                <FaListOl />
              </button>

              <div className="w-px h-8 bg-gray-300 mx-1" />

              {/* Links & Images */}
              <button
                type="button"
                onClick={insertLink}
                className="p-2 hover:bg-gray-200 rounded"
                title="Insert Link"
              >
                <FaLink />
              </button>
              <button
                type="button"
                onClick={insertImage}
                className="px-3 py-2 text-xs bg-white border rounded hover:bg-gray-50"
                title="Insert Image"
              >
                🖼️ Image
              </button>

              <div className="w-px h-8 bg-gray-300 mx-1" />

              {/* Clear Formatting */}
              <button
                type="button"
                onClick={() => execCommand("removeFormat")}
                className="px-3 py-2 text-xs bg-white border rounded hover:bg-gray-50"
                title="Clear Formatting"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Editor Area */}
        <div className="min-h-[400px]">
          {isPreview ? (
            <div
              className="p-4 prose max-w-none"
              style={{ minHeight: "400px" }}
              dangerouslySetInnerHTML={{ __html: value }}
            />
          ) : isSourceView ? (
            <textarea
              value={sourceCode}
              onChange={handleSourceChange}
              className="w-full p-4 font-mono text-sm border-0 resize-none focus:outline-none"
              style={{ minHeight: "400px" }}
              placeholder="Enter HTML source code..."
            />
          ) : (
            <div
              ref={editorRef}
              contentEditable
              className="p-4 focus:outline-none"
              onInput={handleInput}
              style={{ minHeight: "400px" }}
              suppressContentEditableWarning={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default HtmlMapper;
