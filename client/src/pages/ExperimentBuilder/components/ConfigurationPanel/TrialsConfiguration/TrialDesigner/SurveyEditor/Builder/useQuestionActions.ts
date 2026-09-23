import { writeSurveyQuestions } from "../../../utils/surveyElements";
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
  const applyQuestions = (nextQuestions: Question[]) => {
    onChange(writeSurveyQuestions(surveyJson, nextQuestions));
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      type: "text",
      name: `question${questions.length + 1}`,
      title: `Question ${questions.length + 1}`,
      isRequired: false,
    };

    applyQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], ...updates };
    applyQuestions(updatedQuestions);
  };

  const deleteQuestion = (index: number) => {
    applyQuestions(questions.filter((_: unknown, i: number) => i !== index));
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const updatedQuestions = [...questions];
    [updatedQuestions[index], updatedQuestions[newIndex]] = [
      updatedQuestions[newIndex],
      updatedQuestions[index],
    ];
    applyQuestions(updatedQuestions);
  };

  return { addQuestion, updateQuestion, deleteQuestion, moveQuestion };
};
