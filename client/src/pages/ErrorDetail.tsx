import { isRouteErrorResponse, useRouteError } from "react-router-dom";

type Props = {};

function ErrorDetail({}: Props) {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <div>This page doesn't exist.</div>;
  }

  return (
    <div>
      {error instanceof Error
        ? `An error occurred: ${error.message}`
        : "An unexpected error occurred."}
    </div>
  );
}

export default ErrorDetail;
