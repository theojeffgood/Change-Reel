interface TestComponentProps {
  title?: string;
}

export default function TestComponent({
  title = 'Tailwind CSS Test',
}: TestComponentProps) {
  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl">
      <div className="md:flex">
        <div className="p-8">
          <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">
            Change Reel
          </div>
          <h2 className="block mt-1 text-lg leading-tight font-medium text-black">
            {title}
          </h2>
          <p className="mt-2 text-slate-500">
            This component demonstrates that Tailwind CSS is properly configured
            and working.
          </p>
          <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            Test Button
          </button>
        </div>
      </div>
    </div>
  );
}
