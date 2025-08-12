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
        <label className="block mb-3 text-base font-semibold text-gray-800 tracking-wide">
          {label}
        </label>
      )}

      <div className="border rounded-2xl overflow-hidden bg-gradient-to-br from-white via-gray-50 to-gray-100 shadow-xl transition-shadow duration-300 hover:shadow-2xl">
        {/* Mode Toggle */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-2 border-b flex gap-2 sticky top-0 z-10">
          <button
            type="button"
            onClick={() => {
              setIsPreview(false);
              setIsSourceView(false);
            }}
            className={`flex items-center gap-1 px-4 py-1.5 text-sm rounded-full font-medium shadow transition-all duration-150 ${
              !isPreview && !isSourceView
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white text-blue-700 hover:bg-blue-50"
            }`}
          >
            <FaFont className="inline" /> Editar
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPreview(true);
              setIsSourceView(false);
            }}
            className={`flex items-center gap-1 px-4 py-1.5 text-sm rounded-full font-medium shadow transition-all duration-150 ${
              isPreview
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white text-blue-700 hover:bg-blue-50"
            }`}
          >
            <FaEye className="inline" /> Vista previa
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPreview(false);
              setIsSourceView(true);
            }}
            className={`flex items-center gap-1 px-4 py-1.5 text-sm rounded-full font-medium shadow transition-all duration-150 ${
              isSourceView
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white text-blue-700 hover:bg-blue-50"
            }`}
          >
            <FaCode className="inline" /> Código
          </button>
        </div>

        {/* Toolbar */}
        {!isPreview && !isSourceView && (
          <div className="bg-white/80 backdrop-blur p-4 border-b">
            {/* Primera fila */}
            <div className="flex flex-wrap gap-2 mb-3">
              {/* Undo/Redo */}
              <button
                type="button"
                onClick={() => execCommand("undo")}
                className="toolbar-btn"
                title="Deshacer"
              >
                <FaUndo />
              </button>
              <button
                type="button"
                onClick={() => execCommand("redo")}
                className="toolbar-btn"
                title="Rehacer"
              >
                <FaRedo />
              </button>

              <div className="w-px h-8 bg-gray-200 mx-2" />

              {/* Text Formatting */}
              <button
                type="button"
                onClick={() => execCommand("bold")}
                className="toolbar-btn font-bold"
                title="Negrita"
              >
                <FaBold />
              </button>
              <button
                type="button"
                onClick={() => execCommand("italic")}
                className="toolbar-btn"
                title="Cursiva"
              >
                <FaItalic />
              </button>
              <button
                type="button"
                onClick={() => execCommand("underline")}
                className="toolbar-btn"
                title="Subrayado"
              >
                <FaUnderline />
              </button>
              <button
                type="button"
                onClick={() => execCommand("strikeThrough")}
                className="toolbar-btn"
                title="Tachado"
              >
                <FaStrikethrough />
              </button>

              <div className="w-px h-8 bg-gray-200 mx-2" />

              {/* Colors */}
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">Texto:</label>
                <input
                  type="color"
                  onChange={changeTextColor}
                  className="w-7 h-7 border-2 border-gray-200 rounded-full cursor-pointer"
                  title="Color de texto"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">Fondo:</label>
                <input
                  type="color"
                  onChange={changeBackgroundColor}
                  className="w-7 h-7 border-2 border-gray-200 rounded-full cursor-pointer"
                  title="Color de fondo"
                />
              </div>
            </div>

            {/* Segunda fila */}
            <div className="flex flex-wrap gap-2 mb-3">
              {/* Font Family */}
              <select
                onChange={changeFontFamily}
                className="px-2 py-1 text-sm border rounded-lg bg-white shadow-sm"
                defaultValue=""
              >
                <option value="">Fuente</option>
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
                className="px-2 py-1 text-sm border rounded-lg bg-white shadow-sm"
                defaultValue=""
              >
                <option value="">Tamaño</option>
                <option value="1">Muy pequeño</option>
                <option value="2">Pequeño</option>
                <option value="3">Normal</option>
                <option value="4">Mediano</option>
                <option value="5">Grande</option>
                <option value="6">Muy grande</option>
                <option value="7">Enorme</option>
              </select>

              {/* Format Block */}
              <select
                onChange={formatBlock}
                className="px-2 py-1 text-sm border rounded-lg bg-white shadow-sm"
                defaultValue=""
              >
                <option value="">Formato</option>
                <option value="h1">Título 1</option>
                <option value="h2">Título 2</option>
                <option value="h3">Título 3</option>
                <option value="h4">Título 4</option>
                <option value="h5">Título 5</option>
                <option value="h6">Título 6</option>
                <option value="p">Párrafo</option>
                <option value="div">Div</option>
                <option value="pre">Preformateado</option>
              </select>
            </div>

            {/* Tercera fila */}
            <div className="flex flex-wrap gap-2">
              {/* Alignment */}
              <button
                type="button"
                onClick={() => execCommand("justifyLeft")}
                className="toolbar-btn"
                title="Alinear a la izquierda"
              >
                <FaAlignLeft />
              </button>
              <button
                type="button"
                onClick={() => execCommand("justifyCenter")}
                className="toolbar-btn"
                title="Centrar"
              >
                <FaAlignCenter />
              </button>
              <button
                type="button"
                onClick={() => execCommand("justifyRight")}
                className="toolbar-btn"
                title="Alinear a la derecha"
              >
                <FaAlignRight />
              </button>

              <div className="w-px h-8 bg-gray-200 mx-2" />

              {/* Lists */}
              <button
                type="button"
                onClick={() => execCommand("insertUnorderedList")}
                className="toolbar-btn"
                title="Lista de viñetas"
              >
                <FaListUl />
              </button>
              <button
                type="button"
                onClick={() => execCommand("insertOrderedList")}
                className="toolbar-btn"
                title="Lista numerada"
              >
                <FaListOl />
              </button>

              <div className="w-px h-8 bg-gray-200 mx-2" />

              {/* Links & Images */}
              <button
                type="button"
                onClick={insertLink}
                className="toolbar-btn"
                title="Insertar enlace"
              >
                <FaLink />
              </button>
              <button
                type="button"
                onClick={insertImage}
                className="toolbar-btn"
                title="Insertar imagen"
              >
                🖼️
              </button>

              <div className="w-px h-8 bg-gray-200 mx-2" />

              {/* Clear Formatting */}
              <button
                type="button"
                onClick={() => execCommand("removeFormat")}
                className="toolbar-btn"
                title="Limpiar formato"
              >
                Limpiar
              </button>
            </div>
          </div>
        )}

        {/* Editor Area */}
        <div className="min-h-[400px] transition-all duration-300">
          {isPreview ? (
            <div
              className="p-6 prose max-w-none bg-white/70 rounded-b-2xl min-h-[400px] animate-fade-in"
              style={{ minHeight: "400px" }}
              dangerouslySetInnerHTML={{ __html: value }}
            />
          ) : isSourceView ? (
            <textarea
              value={sourceCode}
              onChange={handleSourceChange}
              className="w-full p-6 font-mono text-sm border-0 resize-none focus:outline-none bg-gray-50 rounded-b-2xl min-h-[400px] animate-fade-in"
              style={{ minHeight: "400px" }}
              placeholder="Introduce código HTML..."
            />
          ) : (
            <div
              ref={editorRef}
              contentEditable
              className="p-6 focus:outline-none bg-white/90 rounded-b-2xl min-h-[400px] animate-fade-in"
              onInput={handleInput}
              style={{ minHeight: "400px" }}
              suppressContentEditableWarning={true}
            />
          )}
        </div>
      </div>
      {/* Extra: estilos para los botones de la toolbar */}
      <style>{`
        .toolbar-btn {
          @apply p-2 bg-white text-gray-700 rounded-lg shadow-sm hover:bg-blue-100 hover:text-blue-700 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-300;
        }
        .animate-fade-in {
          animation: fadeIn 0.3s;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px);}
          to { opacity: 1; transform: translateY(0);}
        }
      `}</style>
    </div>
  );
};

export default HtmlMapper;
