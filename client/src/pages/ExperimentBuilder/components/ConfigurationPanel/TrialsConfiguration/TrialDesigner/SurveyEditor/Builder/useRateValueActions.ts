import { Question, RateValue } from "./types";

type Props = {
  questions: Question[];
  updateQuestion: (index: number, updates: Partial<Question>) => void;
};

export const useRateValueActions = ({ questions, updateQuestion }: Props) => {
  const addRateValue = (index: number) => {
    const currentRateValues = questions[index].rateValues || [];
    const newRateValue: RateValue = {
      value: "", // El value será el mismo que el text
      text: "",
    };
    updateQuestion(index, { rateValues: [...currentRateValues, newRateValue] });
  };

  const updateRateValue = (
    questionIndex: number,
    rateIndex: number,
    value: string,
  ) => {
    const currentRateValues = [...(questions[questionIndex].rateValues || [])];
    currentRateValues[rateIndex] = {
      ...currentRateValues[rateIndex],
      text: value,
      value: value, // Sincronizar value con text
    };
    updateQuestion(questionIndex, { rateValues: currentRateValues });
  };

  const removeRateValue = (questionIndex: number, rateIndex: number) => {
    const currentRateValues = [...(questions[questionIndex].rateValues || [])];
    currentRateValues.splice(rateIndex, 1);
    updateQuestion(questionIndex, { rateValues: currentRateValues });
  };
  return { addRateValue, updateRateValue, removeRateValue };
};
