import { AICommandInput } from '@/components/AICommandInput';

export default function AICommanderPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Commander</h1>
          <p className="mt-2 text-gray-600">
            Use natural language to manage timetables. The AI will understand your commands
            and execute them safely with constraint validation.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-blue-900 mb-2">How it works</h2>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Type your command in natural language</li>
            <li>AI retrieves relevant context from the database (RAG pattern)</li>
            <li>Command is validated against scheduling constraints</li>
            <li>Operation is executed within 3 seconds</li>
            <li>All commands are logged for audit purposes</li>
          </ul>
        </div>

        <AICommandInput />

        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Context Retrieval</h3>
              <p className="text-sm text-gray-600">
                AI retrieves teacher availability, current assignments, and constraints
                before processing your command.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Constraint Validation</h3>
              <p className="text-sm text-gray-600">
                All operations are validated against burnout protection, double-booking
                prevention, and other scheduling rules.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Performance</h3>
              <p className="text-sm text-gray-600">
                Commands are processed within 3 seconds with LRU caching for frequently
                used operations.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Graceful Degradation</h3>
              <p className="text-sm text-gray-600">
                If AI is unavailable, you'll be directed to the manual interface with
                helpful suggestions.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Supported Operations</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <span className="font-medium min-w-24">Assign Period:</span>
              <span>Assign [Subject] to [Teacher] for [Class] on [Day] period [Number]</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium min-w-24">Substitution:</span>
              <span>Create substitution request for [Teacher]'s [Subject] class [Day/Time]</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium min-w-24">Query:</span>
              <span>Show me all [Subject] classes on [Day]</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium min-w-24">Remove:</span>
              <span>Remove period [Number] for teacher [Name] on [Day]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
