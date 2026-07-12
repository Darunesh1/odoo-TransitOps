export const getErrorMessage = (err: any): string => {
  const detail = err.response?.data?.detail;
  if (!detail) {
    return err.message || "Operation failed";
  }
  if (Array.isArray(detail)) {
    return detail.map((e: any) => {
      // Remove 'body.' prefix if present in Pydantic loc
      const field = e.loc && e.loc.length > 1 && e.loc[0] === 'body' 
        ? e.loc.slice(1).join('.') 
        : (e.loc?.join('.') || '');
      return `${field ? field + ': ' : ''}${e.msg}`;
    }).join("\n");
  }
  if (typeof detail === "object" && detail !== null) {
    return JSON.stringify(detail);
  }
  return detail;
};
