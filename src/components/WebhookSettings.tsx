import React, { useState, useEffect } from 'react';
import { Save, TestTube } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WebhookSettingsProps {}

const WebhookSettings: React.FC<WebhookSettingsProps> = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadWebhookSettings();
  }, []);

  const loadWebhookSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('webhook_settings')
        .select('*')
        .single();

      if (error) throw error;
      
      if (data) {
        setWebhookUrl(data.url || '');
        setIsEnabled(data.is_enabled || false);
      }
    } catch (error) {
      console.error('Failed to load webhook settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const { error } = await supabase
        .from('webhook_settings')
        .upsert({
          id: 1, // Single record
          url: webhookUrl,
          is_enabled: isEnabled,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      alert('Webhook settings saved successfully!');
    } catch (error) {
      console.error('Failed to save webhook settings:', error);
      alert('Failed to save webhook settings. Please try again.');
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl) {
      alert('Please enter a webhook URL first');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const testData = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test order from Kopi Dashboard',
          order: {
            id: 'test-123',
            customer_name: 'Test Customer',
            total: 25000,
            items: [
              {
                name: 'Test Coffee',
                quantity: 1,
                price: 25000
              }
            ]
          }
        }
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      setTestResult({
        success: true,
        message: 'Webhook test successful! Your endpoint responded correctly.'
      });
    } catch (error) {
      console.error('Webhook test failed:', error);
      setTestResult({
        success: false,
        message: `Webhook test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Webhook Settings</h1>
        <p className="text-gray-600 mt-1">Configure webhook to receive order notifications on your server</p>
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="space-y-4">
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm font-medium text-gray-700">Enable Webhook</span>
            </label>
            <p className="mt-1 text-sm text-gray-500">
              When enabled, all new orders will be sent to your webhook URL
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Webhook URL
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              disabled={!isEnabled}
            />
            <p className="mt-1 text-sm text-gray-500">
              The URL where order notifications will be sent via POST request
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              onClick={saveSettings}
              className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>Save Settings</span>
            </button>
            <button
              onClick={testWebhook}
              disabled={!isEnabled || !webhookUrl || isTesting}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TestTube className="h-4 w-4" />
              <span>{isTesting ? 'Testing...' : 'Test Webhook'}</span>
            </button>
          </div>

          {testResult && (
            <div className={`mt-4 p-4 rounded-lg ${
              testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Documentation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhook Documentation</h3>
        <div className="prose prose-sm max-w-none">
          <p>
            When enabled, your webhook endpoint will receive a POST request for every new order with the following JSON payload:
          </p>
          <pre className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
{`{
  "event": "new_order",
  "timestamp": "2024-02-26T06:00:00.000Z",
  "data": {
    "id": "order-uuid",
    "customer_name": "Customer Name",
    "phone": "Phone Number",
    "total": 50000,
    "status": "pending",
    "additional": "Order notes",
    "items": [
      {
        "menu_item_id": "item-uuid",
        "name": "Item Name",
        "quantity": 2,
        "price_at_time": 25000
      }
    ]
  }
}`}
          </pre>
          <p className="mt-4">
            Your endpoint should respond with a 200 status code to acknowledge receipt of the webhook.
            If your endpoint fails to respond or returns an error, we will log the failure but the order will still be created.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WebhookSettings;
