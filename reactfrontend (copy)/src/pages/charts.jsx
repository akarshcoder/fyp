import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const TradeCharts = () => {
  const [tradeData, setTradeData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [timeFrame, setTimeFrame] = useState('1D');
  const [marketStats, setMarketStats] = useState(null);
  const [marketState, setMarketState] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch all data in parallel
        const [historyRes, priceRes, statsRes, stateRes] = await Promise.all([
          fetch('http://localhost:8080/api/getTradeHistory', { headers }),
          fetch('http://localhost:8080/api/getCurrentPrice', { headers }),
          fetch('http://localhost:8080/api/getMarketStatistics', { headers }),
          fetch('http://localhost:8080/api/getMarketState', { headers })
        ]);

        const [historyData, priceData, statsData, stateData] = await Promise.all([
          historyRes.json(),
          priceRes.json(),
          statsRes.json(),
          stateRes.json()
        ]);

        setCurrentPrice(priceData);
        setMarketStats(statsData);
        setMarketState(stateData);

        const processedData = historyData.map(trade => ({
          timestamp: new Date(trade.timestamp).toISOString(),
          price: trade.price,
          volume: trade.quantity,
          totalValue: trade.totalValue,
          producerId: trade.producerId
        }));

        setTradeData(processedData.reverse());
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredData = tradeData.filter(d => {
    const tradeDate = new Date(d.timestamp).getTime();
    const currentTime = Date.now();
    const timeFrameLimits = {
      '1D': currentTime - 86400000,
      '1W': currentTime - 7 * 86400000,
      '1M': currentTime - 30 * 86400000
    };
    return tradeDate >= timeFrameLimits[timeFrame];
  });

  const producerData = marketState?.producers.map(producer => ({
    name: producer.id,
    value: producer.production,
    cost: producer.cost
  })) || [];

  const consumerData = marketState?.consumers.map(consumer => ({
    name: consumer.id,
    value: consumer.totalDemand,
    balance: consumer.balance
  })) || [];

  return (
    <div className="space-y-4 p-4">
      {/* Market Statistics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border rounded-lg shadow-md p-4 bg-white">
          <h3 className="text-sm text-gray-500">Total Generation</h3>
          <p className="text-xl font-bold">{marketStats?.totalGenerationCapacity?.toFixed(2)} MW</p>
        </div>
        <div className="border rounded-lg shadow-md p-4 bg-white">
          <h3 className="text-sm text-gray-500">Total Demand</h3>
          <p className="text-xl font-bold">{marketStats?.totalDemand?.toFixed(2)} MW</p>
        </div>
        <div className="border rounded-lg shadow-md p-4 bg-white">
          <h3 className="text-sm text-gray-500">Social Welfare</h3>
          <p className="text-xl font-bold">₹{marketStats?.socialWelfare?.toFixed(2)}</p>
        </div>
        <div className="border rounded-lg shadow-md p-4 bg-white">
          <h3 className="text-sm text-gray-500">24h Volume</h3>
          <p className="text-xl font-bold">₹{marketStats?.volume24h?.toFixed(2)}</p>
        </div>
      </div>

      {/* Current Price Section */}
      <div className="border rounded-lg shadow-md p-4 bg-white">
        <h2 className="text-xl font-bold">
          Current Price: ₹{currentPrice?.currentPrice?.toFixed(2)}
          <span className={`ml-2 text-sm ${currentPrice?.priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {currentPrice?.priceChange >= 0 ? '↑' : '↓'} {Math.abs(currentPrice?.priceChange)}%
          </span>
        </h2>
      </div>

      {/* Time Frame Selector */}
      <div className="flex space-x-2">
        {['1D', '1W', '1M'].map(tf => (
          <button
            key={tf}
            onClick={() => setTimeFrame(tf)}
            className={`px-4 py-2 rounded-md transition ${
              timeFrame === tf 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Price Chart */}
        <div className="border rounded-lg shadow-md p-4 bg-white">
          <h2 className="text-xl font-bold mb-2">Price History</h2>
          <div className="h-96">
            {filteredData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" />
                  <YAxis domain={['auto', 'auto']} tickCount={5} allowDecimals={true} />
                  <Tooltip />
                  <Line type="monotone" dataKey="price" stroke="#2563eb" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500">No data available</p>
            )}
          </div>
        </div>

        {/* Volume Chart */}
        <div className="border rounded-lg shadow-md p-4 bg-white">
          <h2 className="text-xl font-bold mb-2">Trading Volume</h2>
          <div className="h-96">
            {filteredData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="volume" fill="#2563eb" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500">No data available</p>
            )}
          </div>
        </div>

        {/* Producer Distribution */}
        <div className="border rounded-lg shadow-md p-4 bg-white">
          <h2 className="text-xl font-bold mb-2">Producer Distribution</h2>
          <div className="h-96">
            {producerData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={producerData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {producerData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500">No producer data available</p>
            )}
          </div>
        </div>

        {/* Consumer Distribution */}
        <div className="border rounded-lg shadow-md p-4 bg-white">
          <h2 className="text-xl font-bold mb-2">Consumer Distribution</h2>
          <div className="h-96">
            {consumerData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={consumerData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {consumerData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500">No consumer data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeCharts;
