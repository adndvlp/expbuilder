import { Question } from "./types";

type Props = {
  questions: Question[];
  onChange: (json: Record<string, unknown>) => void;
  surveyJson: Record<string, unknown>;
};

export const useQuestionActions = ({
  questions,
  onChange,
  surveyJson,
}: Props) => {
  const addQuestion = () => {
    const newQuestion: Question = {
      type: "text",
      name: `question${questions.length + 1}`,
      title: `Question ${questions.length + 1}`,
      isRequired: false,
    };

    onChange({
      ...surveyJson,
      elements: [...questions, newQuestion],
    });
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], ...updates };
    onChange({
      ...surveyJson,
      elements: updatedQuestions,
    });
  };

  const deleteQuestion = (index: number) => {
    const updatedQuestions = questions.filter(
      (_: unknown, i: number) => i !== index,
    );
    onChange({
      ...surveyJson,
      elements: updatedQuestions,
    });
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const updatedQuestions = [...questions];
    [updatedQuestions[index], updatedQuestions[newIndex]] = [
      updatedQuestions[newIndex],
      updatedQuestions[index],
    ];
    onChange({
      ...surveyJson,
      elements: updatedQuestions,
    });
  };
  return { addQuestion, updateQuestion, deleteQuestion, moveQuestion };
};
