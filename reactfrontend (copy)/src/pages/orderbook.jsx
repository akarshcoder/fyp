import io from 'socket.io-client';
import React, { useEffect, useState } from 'react';

export default function Orderbook() {
    const [orderBook, setOrderBook] = useState(null);
    const [marketState, setMarketState] = useState(null);

    useEffect(() => {
        // Connect to the WebSocket server
        const socket = io('http://localhost:8080');

        // Listen for order book updates
        socket.on('orderBookUpdate', (data) => {
            setOrderBook(data);
        });

        // Fetch initial market state
        const fetchMarketState = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:8080/api/getMarketState', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await response.json();
                setMarketState(data);
            } catch (error) {
                console.error('Failed to fetch market state:', error);
            }
        };

        fetchMarketState();

        // Error handling
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        // Cleanup on component unmount
        return () => {
            socket.disconnect();
        };
    }, []);

    const getProducerName = (producerId) => {
        if (!marketState) return producerId;
        const producer = marketState.producers.find(p => p.id === producerId);
        return producer ? producer.id : producerId;
    };

    return (
        <div className="p-4 bg-white text-black font-mono">
            <h2 className="text-xl font-bold mb-4">Order Book</h2>
            {orderBook ? (
                <div className="grid grid-cols-2 gap-4">
                    {/* Sell Orders */}
                    <div>
                        <h3 className="text-red-500 text-lg font-semibold mb-2">Sell Orders</h3>
                        <div className="border-b border-gray-700 pb-2 mb-2">
                            <div className="grid grid-cols-4 gap-2 text-gray-400 text-sm">
                                <span>Price (₹)</span>
                                <span>Qty</span>
                                <span>Producer</span>
                                <span>Seller</span>
                            </div>
                        </div>
                        {orderBook.sell.length > 0 ? (
                            orderBook.sell.map((order, index) => (
                                <div key={index} className="grid grid-cols-4 gap-2 text-red-400 py-1">
                                    <span>{parseFloat(order.price).toFixed(4)}</span>
                                    <span>{parseFloat(order.quantity).toFixed(4)}</span>
                                    <span>{getProducerName(order.producerId)}</span>
                                    <span>{order.userId}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-gray-500">No sell orders</div>
                        )}
                    </div>

                    {/* Buy Orders */}
                    <div>
                        <h3 className="text-green-500 text-lg font-semibold mb-2">Buy Orders</h3>
                        <div className="border-b border-gray-700 pb-2 mb-2">
                            <div className="grid grid-cols-3 gap-2 text-gray-400 text-sm">
                                <span>Price (₹)</span>
                                <span>Qty</span>
                                <span>Buyer</span>
                            </div>
                        </div>
                        {orderBook.buy.length > 0 ? (
                            orderBook.buy.map((order, index) => (
                                <div key={index} className="grid grid-cols-3 gap-2 text-green-400 py-1">
                                    <span>{parseFloat(order.price).toFixed(4)}</span>
                                    <span>{parseFloat(order.quantity).toFixed(4)}</span>
                                    <span>{order.userId}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-gray-500">No buy orders</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-gray-400">Loading order book...</div>
            )}
        </div>
    );
}
