
package main

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// EnergyMarket struct for the chaincode
type EnergyMarket struct {
	contractapi.Contract
}

// Producer represents an energy producer/generator
type Producer struct {
	ID            string  `json:"id"`
	A             float64 `json:"a"`             // Quadratic cost coefficient
	B             float64 `json:"b"`             // Linear cost coefficient
	ProductionMin float64 `json:"productionMin"` // Minimum production limit
	ProductionMax float64 `json:"productionMax"` // Maximum production limit
	Production    float64 `json:"production"`    // Current production quantity
	Lambda        float64 `json:"lambda"`        // Current price/marginal cost
	Cost          float64 `json:"cost"`          // Total production cost
	OwnerID       string  `json:"ownerId"`       // ID of the consumer who owns this producer
}

// Consumer represents an energy consumer
type Consumer struct {
	ID          string    `json:"id"`
	Beta        float64   `json:"beta"`        // Utility function parameter
	Theta       float64   `json:"theta"`       // Utility function parameter
	DemandMin   float64   `json:"demandMin"`   // Minimum demand limit
	DemandMax   float64   `json:"demandMax"`   // Maximum demand limit
	UMin        float64   `json:"uMin"`        // Lower multiplier (Lagrangian)
	UMax        float64   `json:"uMax"`        // Upper multiplier (Lagrangian)
	Demands     []float64 `json:"demands"`     // Demand for each producer's energy
	Utilities   []float64 `json:"utilities"`   // Utility derived from each producer
	TotalDemand float64   `json:"totalDemand"` // Sum of demands
	Balance     float64   `json:"balance"`     // Consumer's balance in USD
	ProducerIDs []string  `json:"producerIds"` // IDs of producers owned by this consumer
}

// MarketState represents the current state of the energy market
type MarketState struct {
	Producers       []Producer `json:"producers"`
	Consumers       []Consumer `json:"consumers"`
	TotalGeneration float64    `json:"totalGeneration"`
	TotalDemand     float64    `json:"totalDemand"`
	SocialWelfare   float64    `json:"socialWelfare"`
	IterationCount  int        `json:"iterationCount"`
	Converged       bool       `json:"converged"`
}

// Order represents an energy buy or sell order
type Order struct {
	UserID     string  `json:"userId"`     // ID of the consumer placing the order
	Price      float64 `json:"price"`      // Price per unit of energy
	Quantity   float64 `json:"quantity"`   // Quantity of energy to buy/sell
	OrderType  string  `json:"orderType"`  // "buy" or "sell"
	Timestamp  string  `json:"timestamp"`  // When the order was placed
	ProducerID string  `json:"producerId"` // ID of the producer whose energy is being sold/bought
}

// Trade represents a completed energy trade
type Trade struct {
	BuyerID       string  `json:"buyerId"`
	SellerID      string  `json:"sellerId"`
	ProducerID    string  `json:"producerId"`    // The producer whose energy was traded
	Price         float64 `json:"price"`         // Price per unit of energy
	Quantity      float64 `json:"quantity"`      // Quantity of energy traded
	TotalValue    float64 `json:"totalValue"`    // Total value of the trade (price * quantity)
	Timestamp     string  `json:"timestamp"`     // When the trade was completed
	BlockHeight   uint64  `json:"blockHeight"`   // Block height when the trade was recorded
	TransactionID string  `json:"transactionId"` // Transaction ID for the trade
}

// InitMarket initializes the energy market with producers and consumers
func (s *EnergyMarket) InitMarket(ctx contractapi.TransactionContextInterface) error {
	// Initialize producers with owners
	producers := []Producer{
		{ID: "producer1", A: 0.0080, B: 2.25, ProductionMin: 10, ProductionMax: 350, OwnerID: "consumer1"},
		{ID: "producer2", A: 0.0062, B: 4.20, ProductionMin: 20, ProductionMax: 290, OwnerID: "consumer2"},
		{ID: "producer3", A: 0.0075, B: 3.25, ProductionMin: 15, ProductionMax: 400, OwnerID: "consumer3"},
	}

	// Initialize consumers with their owned producers
	consumers := []Consumer{
		{ID: "consumer1", Beta: 8.25, Theta: 0.0720, DemandMin: 60, DemandMax: 150, ProducerIDs: []string{"producer1"}, Demands: make([]float64, len(producers)), Utilities: make([]float64, len(producers)), Balance: 10000},
		{ID: "consumer2", Beta: 7.90, Theta: 0.0660, DemandMin: 50, DemandMax: 100, ProducerIDs: []string{"producer2"}, Demands: make([]float64, len(producers)), Utilities: make([]float64, len(producers)), Balance: 10000},
		{ID: "consumer3", Beta: 7.55, Theta: 0.0700, DemandMin: 90, DemandMax: 145, ProducerIDs: []string{"producer3"}, Demands: make([]float64, len(producers)), Utilities: make([]float64, len(producers)), Balance: 10000},
		{ID: "consumer4", Beta: 8.00, Theta: 0.0550, DemandMin: 60, DemandMax: 140, ProducerIDs: []string{}, Demands: make([]float64, len(producers)), Utilities: make([]float64, len(producers)), Balance: 10000},
		{ID: "consumer5", Beta: 7.75, Theta: 0.0750, DemandMin: 50, DemandMax: 150, ProducerIDs: []string{}, Demands: make([]float64, len(producers)), Utilities: make([]float64, len(producers)), Balance: 10000},
		{ID: "consumer6", Beta: 8.05, Theta: 0.0450, DemandMin: 70, DemandMax: 170, ProducerIDs: []string{}, Demands: make([]float64, len(producers)), Utilities: make([]float64, len(producers)), Balance: 10000},
	}

	// Initialize production values for producers
	for i := range producers {
		producers[i].Lambda = 2*producers[i].A*producers[i].ProductionMin + producers[i].B
		producers[i].Production = (producers[i].Lambda - producers[i].B) / (2 * producers[i].A)
		producers[i].Cost = producers[i].A*math.Pow(producers[i].Production, 2) + producers[i].B*producers[i].Production
	}

	marketState := MarketState{
		Producers:      producers,
		Consumers:      consumers,
		IterationCount: 0,
		Converged:      false,
	}

	marketStateJSON, err := json.Marshal(marketState)
	if err != nil {
		return fmt.Errorf("failed to marshal market state: %v", err)
	}

	err = ctx.GetStub().PutState("MarketState", marketStateJSON)
	if err != nil {
		return fmt.Errorf("failed to put market state: %v", err)
	}

	return nil
}

// GetMarketState retrieves the current market state
func (s *EnergyMarket) GetMarketState(ctx contractapi.TransactionContextInterface) (*MarketState, error) {
	marketStateJSON, err := ctx.GetStub().GetState("MarketState")
	if err != nil {
		return nil, fmt.Errorf("failed to read market state: %v", err)
	}
	if marketStateJSON == nil {
		return nil, fmt.Errorf("market state does not exist")
	}

	var marketState MarketState
	err = json.Unmarshal(marketStateJSON, &marketState)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal market state: %v", err)
	}

	return &marketState, nil
}

// UpdateMarket runs one iteration of the market clearing algorithm
func (s *EnergyMarket) UpdateMarket(ctx contractapi.TransactionContextInterface) error {
	marketState, err := s.GetMarketState(ctx)
	if err != nil {
		return err
	}

	// Create arrays to hold total demand for each producer
	producerDemands := make([]float64, len(marketState.Producers))

	// Step 1: Initialize or update consumer demands
	if marketState.IterationCount == 0 {
		initializeConsumerDemands(marketState, producerDemands)
	} else {
		// Calculate current producer demands from existing consumer demands
		for j := range marketState.Consumers {
			consumer := &marketState.Consumers[j]
			consumer.TotalDemand = 0

			for i := range marketState.Producers {
				producerDemands[i] += consumer.Demands[i]
				consumer.TotalDemand += consumer.Demands[i]
			}
		}
	}

	// Step 2: Update producers (supply side)
	totalCost := 0.0
	// Store previous lambdas for convergence check
	prevLambdas := make([]float64, len(marketState.Producers))
	for i := range marketState.Producers {
		prevLambdas[i] = marketState.Producers[i].Lambda
	}

	for i := range marketState.Producers {
		producer := &marketState.Producers[i]

		// Update lambda (price) based on supply-demand difference
		// Using a dynamic step size that decreases as we get closer to equilibrium
		stepSize := 0.005 / math.Sqrt(float64(marketState.IterationCount+1))
		producer.Lambda = producer.Lambda - (stepSize * (producer.Production - producerDemands[i]))
		if producer.Lambda < 0 {
			producer.Lambda = 0
		}

		// Update production based on new lambda
		producer.Production = (producer.Lambda - producer.B) / (2 * producer.A)

		// Apply production constraints
		if producer.Production < producer.ProductionMin {
			producer.Production = producer.ProductionMin
			// Recalculate lambda for constrained production
			producer.Lambda = 2*producer.A*producer.Production + producer.B
		} else if producer.Production > producer.ProductionMax {
			producer.Production = producer.ProductionMax
			// Recalculate lambda for constrained production
			producer.Lambda = 2*producer.A*producer.Production + producer.B
		}

		// Calculate cost
		producer.Cost = producer.A*math.Pow(producer.Production, 2) + producer.B*producer.Production
		totalCost += producer.Cost
	}

	// Calculate total generation
	totalGeneration := 0.0
	for _, producer := range marketState.Producers {
		totalGeneration += producer.Production
	}
	marketState.TotalGeneration = totalGeneration

	// Step 3: Update consumers (demand side)
	totalUtility := 0.0
	totalDemand := 0.0

	for j := range marketState.Consumers {
		consumer := &marketState.Consumers[j]

		// Reset total demand for this consumer
		consumer.TotalDemand = 0

		// Update multipliers with dynamic step size
		stepSize := 0.0001 / math.Sqrt(float64(marketState.IterationCount+1))

		// Update lower multiplier (for minimum demand constraint)
		consumer.UMin = consumer.UMin + (stepSize * (consumer.DemandMin - consumer.TotalDemand))
		if consumer.UMin < 0 {
			consumer.UMin = 0
		}

		// Update upper multiplier (for maximum demand constraint)
		consumer.UMax = consumer.UMax + (stepSize * (consumer.TotalDemand - consumer.DemandMax))
		if consumer.UMax < 0 {
			consumer.UMax = 0
		}

		// Update demands for each producer
		for i := range marketState.Producers {
			producer := marketState.Producers[i]

			// Calculate new demand
			demand := (consumer.Beta + consumer.UMin - consumer.UMax - producer.Lambda) / consumer.Theta

			// Apply demand constraints
			if demand < 0 {
				demand = 0
			}

			consumer.Demands[i] = demand
			consumer.TotalDemand += demand

			// Calculate utility
			utility := consumer.Beta*demand - 0.5*consumer.Theta*math.Pow(demand, 2)
			consumer.Utilities[i] = utility
			totalUtility += utility
		}

		// Apply overall demand constraints
		if consumer.TotalDemand < consumer.DemandMin {
			// Scale up demands proportionally
			scale := consumer.DemandMin / math.Max(consumer.TotalDemand, 0.0001)
			for i := range consumer.Demands {
				consumer.Demands[i] *= scale
				// Recalculate utility with scaled demand
				consumer.Utilities[i] = consumer.Beta*consumer.Demands[i] - 0.5*consumer.Theta*math.Pow(consumer.Demands[i], 2)
			}
			consumer.TotalDemand = consumer.DemandMin
		} else if consumer.TotalDemand > consumer.DemandMax {
			// Scale down demands proportionally
			scale := consumer.DemandMax / consumer.TotalDemand
			for i := range consumer.Demands {
				consumer.Demands[i] *= scale
				// Recalculate utility with scaled demand
				consumer.Utilities[i] = consumer.Beta*consumer.Demands[i] - 0.5*consumer.Theta*math.Pow(consumer.Demands[i], 2)
			}
			consumer.TotalDemand = consumer.DemandMax
		}

		totalDemand += consumer.TotalDemand
	}

	marketState.TotalDemand = totalDemand

	// Step 4: Calculate social welfare (objective function)
	marketState.SocialWelfare = totalUtility - totalCost

	// Step 5: Check for convergence
	convergenceThreshold := 0.00009
	supplyDemandGap := math.Abs(marketState.TotalGeneration - marketState.TotalDemand)

	// Check if all lambdas have converged and supply-demand is balanced
	converged := true
	for i, producer := range marketState.Producers {
		if math.Abs(producer.Lambda-prevLambdas[i]) > convergenceThreshold {
			converged = false
			break
		}
	}

	if supplyDemandGap > 1.0 { // 1 MW tolerance
		converged = false
	}

	// If converged, record trades between consumers and producers
	if converged && !marketState.Converged {
		err := s.recordOptimizedTrades(ctx, marketState)
		if err != nil {
			return fmt.Errorf("failed to record optimized trades: %v", err)
		}
	}

	marketState.Converged = converged

	// Step 6: Increment iteration counter
	marketState.IterationCount++

	// Step 7: Store updated market state
	marketStateJSON, err := json.Marshal(marketState)
	if err != nil {
		return fmt.Errorf("failed to marshal updated market state: %v", err)
	}

	err = ctx.GetStub().PutState("MarketState", marketStateJSON)
	if err != nil {
		return fmt.Errorf("failed to update market state: %v", err)
	}

	return nil
}

// Helper function to initialize consumer demands
func initializeConsumerDemands(marketState *MarketState, producerDemands []float64) {
	for j := range marketState.Consumers {
		consumer := &marketState.Consumers[j]
		consumer.TotalDemand = 0

		// First calculate unconstrained demands
		for i := range marketState.Producers {
			producer := marketState.Producers[i]
			// Calculate initial demand using the utility maximization formula
			demand := (consumer.Beta - producer.Lambda) / consumer.Theta

			// Apply individual demand constraints
			if demand < 0 {
				demand = 0
			}

			consumer.Demands[i] = demand
			consumer.TotalDemand += demand
		}

		// Then apply overall consumer demand constraints
		if consumer.TotalDemand < consumer.DemandMin {
			// Scale up demands proportionally
			scale := consumer.DemandMin / math.Max(consumer.TotalDemand, 0.0001)
			for i := range consumer.Demands {
				consumer.Demands[i] *= scale
			}
			consumer.TotalDemand = consumer.DemandMin
		} else if consumer.TotalDemand > consumer.DemandMax {
			// Scale down demands proportionally
			scale := consumer.DemandMax / consumer.TotalDemand
			for i := range consumer.Demands {
				consumer.Demands[i] *= scale
			}
			consumer.TotalDemand = consumer.DemandMax
		}

		// Calculate utilities and update producer demands
		for i := range marketState.Producers {
			// Calculate utility
			demand := consumer.Demands[i]
			consumer.Utilities[i] = consumer.Beta*demand - 0.5*consumer.Theta*math.Pow(demand, 2)

			// Update total demand for this producer
			producerDemands[i] += demand
		}
	}
}

// RunMarketUntilConvergence runs the market clearing algorithm until convergence
func (s *EnergyMarket) RunMarketUntilConvergence(ctx contractapi.TransactionContextInterface, maxIterations string) error {
	maxIter, err := strconv.Atoi(maxIterations)
	if err != nil {
		return fmt.Errorf("invalid maximum iterations: %v", err)
	}

	for i := 0; i < maxIter; i++ {
		// Run one iteration
		err = s.UpdateMarket(ctx)
		if err != nil {
			return err
		}

		// Check for convergence
		marketState, err := s.GetMarketState(ctx)
		if err != nil {
			return err
		}

		if marketState.Converged {
			return nil
		}
	}

	return fmt.Errorf("market did not converge after %d iterations", maxIter)
}

// GetMarketResults retrieves the final results of the market clearing
func (s *EnergyMarket) GetMarketResults(ctx contractapi.TransactionContextInterface) (*MarketState, error) {
	return s.GetMarketState(ctx)
}

// recordOptimizedTrades records trades between consumers and producers based on the market clearing results
func (s *EnergyMarket) recordOptimizedTrades(ctx contractapi.TransactionContextInterface, marketState *MarketState) error {
	// When the market clearing algorithm converges, record trades between consumers and producers
	for j, consumer := range marketState.Consumers {
		// Check if this consumer has any energy demand
		if consumer.TotalDemand <= 0 {
			continue
		}

		for i, producer := range marketState.Producers {
			demand := consumer.Demands[i]
			if demand > 0 {
				// Get the owner of this producer
				sellerID := producer.OwnerID

				// Skip if the consumer is buying from their own producer
				if sellerID == consumer.ID {
					continue
				}

				// Create a trade for each non-zero demand
				err := s.recordTrade(ctx, consumer.ID, sellerID, producer.ID, producer.Lambda, demand)
				if err != nil {
					return fmt.Errorf("failed to record optimized trade: %v", err)
				}
				
				// Update consumer balance
				marketState.Consumers[j].Balance -= producer.Lambda * demand

				// Find the seller index and update their balance
				for k, seller := range marketState.Consumers {
					if seller.ID == sellerID {
						marketState.Consumers[k].Balance += producer.Lambda * demand
						break
					}
				}
			}
		}
	}
	return nil
}
func (s *EnergyMarket) PlaceOrder(ctx contractapi.TransactionContextInterface, orderType string, price float64, quantity float64, userID string, producerID string) error {
	// Validate inputs
	if orderType != "buy" && orderType != "sell" {
		return fmt.Errorf("order type must be either 'buy' or 'sell'")
	}
	if price <= 0 {
		return fmt.Errorf("price must be positive")
	}
	if quantity <= 0 {
		return fmt.Errorf("quantity must be positive")
	}

	// Get market state
	marketState, err := s.GetMarketState(ctx)
	if err != nil {
		return err
	}

	// Validate user ID exists
	var userExists bool
	for _, consumer := range marketState.Consumers {
		if consumer.ID == userID {
			userExists = true
			break
		}
	}
	if !userExists {
		return fmt.Errorf("user %s does not exist", userID)
	}

	// For sell orders, validate producer ID and ownership
	if orderType == "sell" {
		if producerID == "" {
			return fmt.Errorf("producer ID is required for sell orders")
		}
		var producerExists, ownershipValid bool
		for _, producer := range marketState.Producers {
			if producer.ID == producerID {
				producerExists = true
				// Additionally, you could check that the order price is not too far from the simulation’s lambda:
				if math.Abs(price-producer.Lambda) > 0.1*producer.Lambda {
					return fmt.Errorf("order price %.2f deviates significantly from producer's market price %.2f", price, producer.Lambda)
				}
				if producer.OwnerID == userID {
					ownershipValid = true
				}
				break
			}
		}
		if !producerExists {
			return fmt.Errorf("producer %s does not exist", producerID)
		}
		if !ownershipValid {
			return fmt.Errorf("user %s does not own producer %s", userID, producerID)
		}
	}

	// Create the order
	order := Order{
		UserID:     userID,
		Price:      price,
		Quantity:   quantity,
		OrderType:  orderType,
		Timestamp:  time.Now().Format(time.RFC3339),
		ProducerID: producerID,
	}

	// Generate a unique key for the order
	key := fmt.Sprintf("ORDER_%s_%s_%s_%s", orderType, strconv.FormatFloat(price, 'f', 2, 64), userID, time.Now().Format("20060102150405"))

	// Store the order in the ledger
	orderJSON, err := json.Marshal(order)
	if err != nil {
		return fmt.Errorf("failed to marshal order: %v", err)
	}
	err = ctx.GetStub().PutState(key, orderJSON)
	if err != nil {
		return fmt.Errorf("failed to place order: %v", err)
	}

	// Immediately try to match orders
	return s.MatchOrders(ctx)
}

// MatchOrders matches buy and sell orders and calls recordTrade to update both the ledger and market state.
func (s *EnergyMarket) MatchOrders(ctx contractapi.TransactionContextInterface) error {
	orderIterator, err := ctx.GetStub().GetStateByRange("ORDER_", "ORDER_~")
	if err != nil {
		return fmt.Errorf("failed to get orders: %v", err)
	}
	defer orderIterator.Close()

	var buyOrders, sellOrders []struct {
		Order Order
		Key   string
	}

	// Collect all orders
	for orderIterator.HasNext() {
		queryResponse, err := orderIterator.Next()
		if err != nil {
			continue
		}
		var order Order
		err = json.Unmarshal(queryResponse.Value, &order)
		if err != nil {
			continue
		}
		orderWithKey := struct {
			Order Order
			Key   string
		}{order, queryResponse.Key}

		if order.OrderType == "buy" {
			buyOrders = append(buyOrders, orderWithKey)
		} else if order.OrderType == "sell" {
			sellOrders = append(sellOrders, orderWithKey)
		}
	}

	// Sort buy orders (highest price first) and sell orders (lowest price first)
	sort.Slice(buyOrders, func(i, j int) bool { return buyOrders[i].Order.Price > buyOrders[j].Order.Price })
	sort.Slice(sellOrders, func(i, j int) bool { return sellOrders[i].Order.Price < sellOrders[j].Order.Price })

	// Process matching
	for len(buyOrders) > 0 && len(sellOrders) > 0 {
		buy := buyOrders[0]
		sell := sellOrders[0]

		// If the highest buy price is lower than the lowest sell price, no match is possible
		if buy.Order.Price < sell.Order.Price {
			break
		}

		// Trade quantity is the minimum of the two orders
		tradeQty := math.Min(buy.Order.Quantity, sell.Order.Quantity)
		// Use the midpoint price for fairness
		tradePrice := (buy.Order.Price + sell.Order.Price) / 2

		// Record the trade; note that recordTrade updates both the ledger and market state
		err := s.recordTrade(ctx, buy.Order.UserID, sell.Order.UserID, sell.Order.ProducerID, tradePrice, tradeQty)
		if err != nil {
			return fmt.Errorf("failed to record trade: %v", err)
		}

		// Update order quantities
		buy.Order.Quantity -= tradeQty
		sell.Order.Quantity -= tradeQty

		// Remove or update orders accordingly
		if buy.Order.Quantity <= 0 {
			err := ctx.GetStub().DelState(buy.Key)
			if err != nil {
				return fmt.Errorf("failed to delete buy order: %v", err)
			}
			buyOrders = buyOrders[1:]
		} else {
			buyJSON, _ := json.Marshal(buy.Order)
			err := ctx.GetStub().PutState(buy.Key, buyJSON)
			if err != nil {
				return fmt.Errorf("failed to update buy order: %v", err)
			}
		}
		if sell.Order.Quantity <= 0 {
			err := ctx.GetStub().DelState(sell.Key)
			if err != nil {
				return fmt.Errorf("failed to delete sell order: %v", err)
			}
			sellOrders = sellOrders[1:]
		} else {
			sellJSON, _ := json.Marshal(sell.Order)
			err := ctx.GetStub().PutState(sell.Key, sellJSON)
			if err != nil {
				return fmt.Errorf("failed to update sell order: %v", err)
			}
		}
	}

	return nil
}

// recordTrade records a trade, updates consumer balances, and (now) updates the producer's traded volume.
func (s *EnergyMarket) recordTrade(ctx contractapi.TransactionContextInterface, buyerID string, sellerID string, producerID string, price float64, quantity float64) error {
	marketState, err := s.GetMarketState(ctx)
	if err != nil {
		return fmt.Errorf("failed to get market state: %v", err)
	}

	var buyerIdx, sellerIdx int
	var buyerFound, sellerFound bool
	for i, consumer := range marketState.Consumers {
		if consumer.ID == buyerID {
			buyerFound = true
			buyerIdx = i
		}
		if consumer.ID == sellerID {
			sellerFound = true
			sellerIdx = i
		}
	}
	if !buyerFound {
		return fmt.Errorf("buyer %s does not exist", buyerID)
	}
	if !sellerFound && sellerID != "MARKET" {
		return fmt.Errorf("seller %s does not exist", sellerID)
	}

	totalValue := price * quantity

	// Update balances in market state
	marketState.Consumers[buyerIdx].Balance -= totalValue
	if sellerID != "MARKET" {
		marketState.Consumers[sellerIdx].Balance += totalValue
	}

	// Update producer traded volume so that simulation could account for executed trades
	for i := range marketState.Producers {
		if marketState.Producers[i].ID == producerID {
			marketState.Producers[i].TradedVolume += quantity
			break
		}
	}

	// Create trade record
	blockHeight, err := ctx.GetStub().GetTxHeight()
	if err != nil {
		return fmt.Errorf("failed to get block height: %v", err)
	}
	txID := ctx.GetStub().GetTxID()

	trade := Trade{
		BuyerID:       buyerID,
		SellerID:      sellerID,
		ProducerID:    producerID,
		Price:         price,
		Quantity:      quantity,
		TotalValue:    totalValue,
		Timestamp:     time.Now().Format(time.RFC3339),
		BlockHeight:   blockHeight,
		TransactionID: txID,
	}

	tradeKey := fmt.Sprintf("TRADE_%s_%s_%s_%s", time.Now().Format("20060102150405"), buyerID, sellerID, producerID)
	tradeJSON, err := json.Marshal(trade)
	if err != nil {
		return fmt.Errorf("failed to marshal trade: %v", err)
	}
	err = ctx.GetStub().PutState(tradeKey, tradeJSON)
	if err != nil {
		return fmt.Errorf("failed to store trade: %v", err)
	}

	// Save updated market state so that subsequent simulation or queries see the latest balances and traded volumes.
	marketStateJSON, err := json.Marshal(marketState)
	if err != nil {
		return fmt.Errorf("failed to marshal market state: %v", err)
	}
	err = ctx.GetStub().PutState("MarketState", marketStateJSON)
	if err != nil {
		return fmt.Errorf("failed to update market state: %v", err)
	}
	return nil
}

// GetOrderBook, GetTradeHistory, and GetCurrentPrice remain largely the same,
// though you may add additional fields to the returned objects if desired.
func (s *EnergyMarket) GetOrderBook(ctx contractapi.TransactionContextInterface) (map[string][]Order, error) {
	orderIterator, err := ctx.GetStub().GetStateByRange("ORDER_", "ORDER_~")
	if err != nil {
		return nil, fmt.Errorf("failed to get orders: %v", err)
	}
	defer orderIterator.Close()

	orderBook := map[string][]Order{
		"buy":  {},
		"sell": {},
	}
	for orderIterator.HasNext() {
		queryResponse, err := orderIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("error iterating orders: %v", err)
		}
		var order Order
		err = json.Unmarshal(queryResponse.Value, &order)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal order: %v", err)
		}
		if order.OrderType == "buy" {
			orderBook["buy"] = append(orderBook["buy"], order)
		} else if order.OrderType == "sell" {
			orderBook["sell"] = append(orderBook["sell"], order)
		}
	}
	sort.Slice(orderBook["buy"], func(i, j int) bool {
		return orderBook["buy"][i].Price > orderBook["buy"][j].Price
	})
	sort.Slice(orderBook["sell"], func(i, j int) bool {
		return orderBook["sell"][i].Price < orderBook["sell"][j].Price
	})
	return orderBook, nil
}

func (s *EnergyMarket) GetTradeHistory(ctx contractapi.TransactionContextInterface) ([]Trade, error) {
	tradeIterator, err := ctx.GetStub().GetStateByRange("TRADE_", "TRADE_~")
	if err != nil {
		return nil, fmt.Errorf("failed to get trades: %v", err)
	}
	defer tradeIterator.Close()

	var trades []Trade
	for tradeIterator.HasNext() {
		queryResponse, err := tradeIterator.Next()
		if err != nil {
			continue
		}
		var trade Trade
		err = json.Unmarshal(queryResponse.Value, &trade)
		if err != nil {
			continue
		}
		trades = append(trades, trade)
	}
	sort.Slice(trades, func(i, j int) bool {
		return trades[i].Timestamp > trades[j].Timestamp
	})
	return trades, nil
}

func (s *EnergyMarket) GetCurrentPrice(ctx contractapi.TransactionContextInterface) (map[string]interface{}, error) {
	trades, err := s.GetTradeHistory(ctx)
	if err != nil {
		return nil, err
	}
	if len(trades) == 0 {
		return map[string]interface{}{
			"currentPrice": nil,
			"message":      "No trades available",
		}, nil
	}
	latestTrade := trades[0]
	currentPrice := latestTrade.Price

	oneDayAgo := time.Now().Add(-24 * time.Hour)
	var oldPrice float64
	var priceChange float64
	for i := len(trades) - 1; i >= 0; i-- {
		tradeTime, err := time.Parse(time.RFC3339, trades[i].Timestamp)
		if err != nil {
			return nil, fmt.Errorf("failed to parse trade timestamp: %v", err)
		}
		if tradeTime.Before(oneDayAgo) {
			oldPrice = trades[i].Price
			break
		}
	}
	if oldPrice != 0 {
		priceChange = ((currentPrice - oldPrice) / oldPrice) * 100
	}
	return map[string]interface{}{
		"currentPrice": currentPrice,
		"priceChange":  priceChange,
	}, nil
}

//EXTRA FUNCTIONS 

//GetUserBalance retrieves a user's current balance
func (s *EnergyMarket) GetUserBalance(ctx contractapi.TransactionContextInterface, userID string) (float64, error) {
	marketState, err := s.GetMarketState(ctx)
	if err != nil {
		return 0, err
	}

	for _, consumer := range marketState.Consumers {
		if consumer.ID == userID {
			return consumer.Balance, nil
		}
	}

	return 0, fmt.Errorf("user %s not found", userID)
}

// GetUserTrades retrieves trades for a specific user
func (s *EnergyMarket) GetUserTrades(ctx contractapi.TransactionContextInterface, userID string) ([]Trade, error) {
	tradeIterator, err := ctx.GetStub().GetStateByRange("TRADE_", "TRADE_~")
	if err != nil {
		return nil, fmt.Errorf("failed to get trades: %v", err)
	}
	defer tradeIterator.Close()

	var userTrades []Trade
	for tradeIterator.HasNext() {
		queryResponse, err := tradeIterator.Next()
		if err != nil {
			continue
		}

		var trade Trade
		err = json.Unmarshal(queryResponse.Value, &trade)
		if err != nil {
			continue
		}

		// Include trades where the user is either buyer or seller
		if trade.BuyerID == userID || trade.SellerID == userID {
			userTrades = append(userTrades, trade)
		}
	}

	// Sort trades by timestamp (newest first)
	sort.Slice(userTrades, func(i, j int) bool {
		return userTrades[i].Timestamp > userTrades[j].Timestamp
	})

	return userTrades, nil
}

// GetProducerDetails retrieves details for a specific producer
func (s *EnergyMarket) GetProducerDetails(ctx contractapi.TransactionContextInterface, producerID string) (*Producer, error) {
	marketState, err := s.GetMarketState(ctx)
	if err != nil {
		return nil, err
	}

	for _, producer := range marketState.Producers {
		if producer.ID == producerID {
			return &producer, nil
		}
	}

	return nil, fmt.Errorf("producer %s not found", producerID)
}

// TransferProducerOwnership transfers ownership of a producer to another consumer
func (s *EnergyMarket) TransferProducerOwnership(ctx contractapi.TransactionContextInterface, producerID string, currentOwnerID string, newOwnerID string) error {
	marketState, err := s.GetMarketState(ctx)
	if err != nil {
		return err
	}

	// Validate current owner
	var producerFound bool
	var producerIndex int
	for i, producer := range marketState.Producers {
		if producer.ID == producerID {
			producerFound = true
			producerIndex = i
			if producer.OwnerID != currentOwnerID {
				return fmt.Errorf("user %s is not the current owner of producer %s", currentOwnerID, producerID)
			}
			break
		}
	}

	if !producerFound {
		return fmt.Errorf("producer %s not found", producerID)
	}

	// Validate new owner
	var newOwnerFound bool
	var newOwnerIndex int
	var currentOwnerIndex int
	for i, consumer := range marketState.Consumers {
		if consumer.ID == newOwnerID {
			newOwnerFound = true
			newOwnerIndex = i
		}
		if consumer.ID == currentOwnerID {
			currentOwnerIndex = i
		}
	}

	if !newOwnerFound {
		return fmt.Errorf("new owner %s not found", newOwnerID)
	}

	// Update producer ownership
	marketState.Producers[producerIndex].OwnerID = newOwnerID

	// Update consumer producer lists
	// Remove from current owner
	for i, id := range marketState.Consumers[currentOwnerIndex].ProducerIDs {
		if id == producerID {
			marketState.Consumers[currentOwnerIndex].ProducerIDs = append(
				marketState.Consumers[currentOwnerIndex].ProducerIDs[:i],
				marketState.Consumers[currentOwnerIndex].ProducerIDs[i+1:]...
			)
			break
		}
	}

	// Add to new owner
	marketState.Consumers[newOwnerIndex].ProducerIDs = append(
		marketState.Consumers[newOwnerIndex].ProducerIDs,
		producerID,
	)

	// Save updated market state
	marketStateJSON, err := json.Marshal(marketState)
	if err != nil {
		return fmt.Errorf("failed to marshal market state: %v", err)
	}

	err = ctx.GetStub().PutState("MarketState", marketStateJSON)
	if err != nil {
		return fmt.Errorf("failed to update market state: %v", err)
	}

	return nil
}

// GetMarketStatistics retrieves various statistics about the market
func (s *EnergyMarket) GetMarketStatistics(ctx contractapi.TransactionContextInterface) (map[string]interface{}, error) {
	marketState, err := s.GetMarketState(ctx)
	if err != nil {
		return nil, err
	}

	trades, err := s.GetTradeHistory(ctx)
	if err != nil {
		return nil, err
	}

	// Calculate total volume in the last 24 hours
	oneDayAgo := time.Now().Add(-24 * time.Hour)
	var volume24h float64
	var tradeCount24h int

	for _, trade := range trades {
		tradeTime, err := time.Parse(time.RFC3339, trade.Timestamp)
		if err != nil {
			continue
		}
		if tradeTime.After(oneDayAgo) {
			volume24h += trade.TotalValue
			tradeCount24h++
		}
	}

	// Calculate average price in the last 24 hours
	var totalPrice24h float64
	for _, trade := range trades {
		tradeTime, err := time.Parse(time.RFC3339, trade.Timestamp)
		if err != nil {
			continue
		}
		if tradeTime.After(oneDayAgo) {
			totalPrice24h += trade.Price
		}
	}

	var avgPrice24h float64
	if tradeCount24h > 0 {
		avgPrice24h = totalPrice24h / float64(tradeCount24h)
	}

	// Get current price
	priceInfo, err := s.GetCurrentPrice(ctx)
	if err != nil {
		return nil, err
	}

	// Calculate market liquidity metrics
	orderBook, err := s.GetOrderBook(ctx)
	if err != nil {
		return nil, err
	}

	var totalBuyVolume, totalSellVolume float64
	for _, order := range orderBook["buy"] {
		totalBuyVolume += order.Quantity
	}
	for _, order := range orderBook["sell"] {
		totalSellVolume += order.Quantity
	}

	return map[string]interface{}{
		"totalGenerationCapacity": marketState.TotalGeneration,
		"totalDemand":             marketState.TotalDemand,
		"socialWelfare":           marketState.SocialWelfare,
		"volume24h":               volume24h,
		"tradeCount24h":           tradeCount24h,
		"averagePrice24h":         avgPrice24h,
		"currentPrice":            priceInfo["currentPrice"],
		"priceChange24h":          priceInfo["priceChange"],
		"totalBuyVolume":          totalBuyVolume,
		"totalSellVolume":         totalSellVolume,
		"producerCount":           len(marketState.Producers),
		"consumerCount":           len(marketState.Consumers),
	}, nil
}

// GetRecentTrades retrieves the most recent trades with an optional limit
func (s *EnergyMarket) GetRecentTrades(ctx contractapi.TransactionContextInterface, limitStr string) ([]Trade, error) {
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 10 // Default limit if parsing fails
	}

	trades, err := s.GetTradeHistory(ctx)
	if err != nil {
		return nil, err
	}

	// Return only the most recent trades up to the limit
	if len(trades) > limit {
		trades = trades[:limit]
	}

	return trades, nil
}

// CreateConsumer creates a new consumer in the market
func (s *EnergyMarket) CreateConsumer(ctx contractapi.TransactionContextInterface, id string, beta float64, theta float64, demandMin float64, demandMax float64, initialBalance float64) error {
	marketState, err := s.GetMarketState(ctx)
	if err != nil {
		return err
	}

	// Check if consumer ID already exists
	for _, consumer := range marketState.Consumers {
		if consumer.ID == id {
			return fmt.Errorf("consumer with ID %s already exists", id)
		}
	}

	// Create new consumer
	newConsumer := Consumer{
		ID:          id,
		Beta:        beta,
		Theta:       theta,
		DemandMin:   demandMin,
		DemandMax:   demandMax,
		UMin:        0,
		UMax:        0,
		Demands:     make([]float64, len(marketState.Producers)),
		Utilities:   make([]float64, len(marketState.Producers)),
		TotalDemand: 0,
		Balance:     initialBalance,
		ProducerIDs: []string{},
	}

	// Add new consumer to market state
	marketState.Consumers = append(marketState.Consumers, newConsumer)

	// Save updated market state
	marketStateJSON, err := json.Marshal(marketState)
	if err != nil {
		return fmt.Errorf("failed to marshal market state: %v", err)
	}

	err = ctx.GetStub().PutState("MarketState", marketStateJSON)
	if err != nil {
		return fmt.Errorf("failed to update market state: %v", err)
	}

	return nil
}

// CreateProducer creates a new producer in the market
func (s *EnergyMarket) CreateProducer(ctx contractapi.TransactionContextInterface, id string, a float64, b float64, productionMin float64, productionMax float64, ownerID string) error {
	marketState, err := s.GetMarketState(ctx)
	if err != nil {
		return err
	}

	// Check if producer ID already exists
	for _, producer := range marketState.Producers {
		if producer.ID == id {
			return fmt.Errorf("producer with ID %s already exists", id)
		}
	}

	// Validate owner
	var ownerExists bool
	var ownerIndex int
	for i, consumer := range marketState.Consumers {
		if consumer.ID == ownerID {
			ownerExists = true
			ownerIndex = i
			break
		}
	}

	if !ownerExists {
		return fmt.Errorf("owner %s not found", ownerID)
	}

	// Create new producer
	newProducer := Producer{
		ID:            id,
		A:             a,
		B:             b,
		ProductionMin: productionMin,
		ProductionMax: productionMax,
		Production:    productionMin,
		Lambda:        2*a*productionMin + b,
		Cost:          a*math.Pow(productionMin, 2) + b*productionMin,
		OwnerID:       ownerID,
	}

	// Add new producer to market state
	marketState.Producers = append(marketState.Producers, newProducer)

	// Update owner's producer list
	marketState.Consumers[ownerIndex].ProducerIDs = append(marketState.Consumers[ownerIndex].ProducerIDs, id)

	// Update demands and utilities arrays for all consumers
	for i := range marketState.Consumers {
		marketState.Consumers[i].Demands = append(marketState.Consumers[i].Demands, 0)
		marketState.Consumers[i].Utilities = append(marketState.Consumers[i].Utilities, 0)
	}

	// Save updated market state
	marketStateJSON, err := json.Marshal(marketState)
	if err != nil {
		return fmt.Errorf("failed to marshal market state: %v", err)
	}

	err = ctx.GetStub().PutState("MarketState", marketStateJSON)
	if err != nil {
		return fmt.Errorf("failed to update market state: %v", err)
	}

	return nil
}

// Main function to start the chaincode
func main() {
	chaincode, err := contractapi.NewChaincode(&EnergyMarket{})
	if err != nil {
		fmt.Printf("Error creating energy market chaincode: %s", err.Error())
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting energy market chaincode: %s", err.Error())
	}
}
