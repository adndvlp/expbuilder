import React from "react";
import {
  RichTextEditorComponent,
  Toolbar,
  Inject,
  HtmlEditor,
  QuickToolbar,
} from "@syncfusion/ej2-react-richtexteditor";

interface HtmlMapperProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

const HtmlMapper: React.FC<HtmlMapperProps> = ({
  value,
  onChange,
  placeholder = "Enter HTML content...",
  label,
}) => {
  const toolbarConfig = {
    items: [
      "Bold",
      "Italic",
      "Underline",
      "StrikeThrough",
      "FontName",
      "FontSize",
      "FontColor",
      "BackgroundColor",
      "LowerCase",
      "UpperCase",
      "|",
      "Formats",
      "Alignments",
      "OrderedList",
      "UnorderedList",
      "Outdent",
      "Indent",
      "|",
      "CreateLink",
      "Image",
      "|",
      "ClearFormat",
      "Print",
      "SourceCode",
      "FullScreen",
      "|",
      "Undo",
      "Redo",
    ],
  };

  const handleChange = (args: any) => {
    onChange(args.value);
  };

  return (
    <div className="html-mapper-container">
      {label && (
        <label className="block mb-2 text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="border rounded-lg overflow-hidden">
        <RichTextEditorComponent
          value={value}
          change={handleChange}
          placeholder={placeholder}
          toolbarSettings={toolbarConfig}
          height={300}
          quickToolbarSettings={{
            enable: true,
          }}
        >
          <Inject services={[Toolbar, HtmlEditor, QuickToolbar]} />
        </RichTextEditorComponent>
      </div>
    </div>
  );
};

export default HtmlMapper;
