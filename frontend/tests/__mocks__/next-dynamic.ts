const dynamic = (fn: () => Promise<unknown>) => fn;
export default dynamic;
