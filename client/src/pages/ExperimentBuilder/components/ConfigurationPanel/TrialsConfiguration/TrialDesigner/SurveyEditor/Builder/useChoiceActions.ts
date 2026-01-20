import { ChoiceItem, Question } from "./types";

type Props = {
  questions: Question[];
  updateQuestion: (index: number, updates: Partial<Question>) => void;
};

export const useChoiceActions = ({ questions, updateQuestion }: Props) => {
  const addChoice = (index: number) => {
    const currentChoices = questions[index].choices || [];
    const newChoice: ChoiceItem = {
      value: "", // El value será el mismo que el text
      text: "",
      imageLink: "",
    };
    updateQuestion(index, { choices: [...currentChoices, newChoice] });
  };

  const updateChoice = (
    questionIndex: number,
    choiceIndex: number,
    field: "text" | "imageLink",
    value: string,
  ) => {
    const currentChoices = [...(questions[questionIndex].choices || [])];
    const choice = currentChoices[choiceIndex];

    // Convertir string a objeto si es necesario
    if (typeof choice === "string") {
      const newText = field === "text" ? value : choice;
      currentChoices[choiceIndex] = {
        value: newText, // value es igual al text
        text: newText,
        imageLink: field === "imageLink" ? value : "",
      };
    } else {
      // Si estamos actualizando el text, también actualizar el value
      const newText = field === "text" ? value : choice.text;
      currentChoices[choiceIndex] = {
        ...choice,
        [field]: value,
        value: newText, // Sincronizar value con text
      };
    }
    updateQuestion(questionIndex, { choices: currentChoices });
  };

  const removeChoice = (questionIndex: number, choiceIndex: number) => {
    const currentChoices = [...(questions[questionIndex].choices || [])];
    currentChoices.splice(choiceIndex, 1);
    updateQuestion(questionIndex, { choices: currentChoices });
  };
  return { addChoice, updateChoice, removeChoice };
};
