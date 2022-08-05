const ethers = require("ethers");
const abi = require("./abi.json");

// constants
const provider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com/");
const privateKey = "<privateKey>";
const wallet = new ethers.Wallet(privateKey, provider);
const exchangeAddress = "0x3253a7e75539edaeb1db608ce6ef9aa1ac9126b6";
const populatedTx = new ethers.Contract(exchangeAddress, abi);
const exchangeContract = new ethers.Contract(exchangeAddress, abi, wallet);

// utils
// utils
async function getGas() {
    const fetchGas = await fetch(
        "https://gasstation-mainnet.matic.network/v2"
    ).then((response) => response.json());
    const maxPriorityFee = JSON.stringify(Math.round(fetchGas.fast.maxPriorityFee + 1));
    const maxFee = JSON.stringify(Math.round(fetchGas.fast.maxFee + 1));
    const parsedmaxPriorityFee = ethers.utils.parseUnits(maxPriorityFee, "9");
    const parsedMaxFee = ethers.utils.parseUnits(maxFee, "9");
    if (parsedmaxPriorityFee.lt(parsedMaxFee)) {
        return [parsedMaxFee, parsedmaxPriorityFee]
    }
    return [parsedmaxPriorityFee, parsedMaxFee];
}

async function returnToken(token) {
    const tokensFetch = await fetch("https://api-matic.idex.io/v1/assets").then(
        (response) => response.json()
    );
    for (i = 0; i < tokensFetch.length; i++) {
        if (token != "MATIC" && tokensFetch[i].symbol == token) {
            console.log(tokensFetch[i])
            return tokensFetch[i];
        } else if (token == "MATIC") {
            throw console.error(
                `Can't deposit MATIC using this function. Use depositMatic instead.`
            );
        }
    }
    throw console.error(`Token "${token}" not found`);
}

// matic deposit
// usage: depositMatic("10000"); Deposits in full matic value. Checks gas for failures
async function depositMatic(amount) {
    const gasPrice = await getGas();
    const transaction = await exchangeContract.populateTransaction.depositEther({
        value: ethers.utils.parseEther(amount),
        type: 2,
        maxFeePerGas: gasPrice[1],
        maxPriorityFeePerGas: gasPrice[0],
        gasLimit: 250000,
    });
    try {
        const estimatedGas = await exchangeContract.provider.estimateGas(
            transaction
        );
        transaction.gasLimit = estimatedGas.mul(1200).div(1000).add(1);
        if (estimatedGas._isBigNumber == true) {
            const dispatch = await exchangeContract.depositEther({
                value: transaction.value,
                type: 2,
                maxFeePerGas: transaction.maxFeePerGas,
                maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
                gasLimit: transaction.gasLimit,
            });
            await dispatch
                .wait()
                .then(
                    console.log(
                        `Deposit of MATIC: ${amount} submitted. \nTxHash: ${dispatch.hash}`
                    )
                );
                const transactionData = async () =>
                await wallet.provider.getTransaction(dispatch.hash);
            console.log(await transactionData());
        }
    } catch (e) {
        console.log(e);
    }
}

// token deposit
// TODO: Check for token allowance and automatic approvals
// usage: depositToken("10000", "USDC"); Deposits in full token value. Automatically fetches token data from idex for parsing. Checks gas for failures
async function depositToken(amount, token) {
    const getToken = await returnToken(token);
    const gasPrice = await getGas();
    const quantity = ethers.utils.parseUnits(amount, getToken.assetDecimals);
    const transaction =
        await populatedTx.populateTransaction.depositTokenByAddress(
            getToken.contractAddress,
            quantity,
            {
                value: ethers.BigNumber.from(0),
                from: wallet.address,
                type: 2,
                maxFeePerGas: gasPrice[1],
                maxPriorityFeePerGas: gasPrice[0],
                gasLimit: 250000,
            }
        );
    try {
        const estimatedGas = await exchangeContract.provider.estimateGas(
            transaction
        );
        transaction.gasLimit = estimatedGas.mul(1200).div(1000).add(1);
        if (estimatedGas._isBigNumber == true) {
            const dispatch = await exchangeContract.depositTokenByAddress(
                getToken.contractAddress,
                quantity,
                {
                    type: 2,
                    maxFeePerGas: transaction.maxFeePerGas,
                    maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
                    gasLimit: transaction.gasLimit,
                }
            );
            await dispatch
                .wait()
                .then(
                    console.log(
                        `Deposit of ${token}: ${amount} submitted. \nTxHash: ${dispatch.hash}`
                    )
                );
            const transactionData = async () =>
                await wallet.provider.getTransaction(dispatch.hash);
            console.log(await transactionData());
        }
    } catch (e) {
        console.log(e);
    }
}
