import Link from "next/link";
import { FC, useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { SolanaLogo, ConnectWallet, Loader } from "components";
import styles from "./index.module.css";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAllDomains,
  performReverseLookup,
  getHashedName,
  getNameAccountKey,
  getTwitterRegistry,
  NameRegistryState,
  transferNameOwnership,
} from "@bonfida/spl-name-service";

import Papa from "papaparse";
import { TldParser } from "@onsol/tldparser";
import { Metaplex } from "@metaplex-foundation/js";

const walletPublicKey = "";

export const MultiSenderView: FC = ({}) => {
  const wallet = useWallet();
  const [walletToParsePublicKey, setWalletToParsePublicKey] =
    useState<string>(walletPublicKey);
  const { publicKey } = useWallet();

  const onUseWalletClick = () => {
    if (publicKey) {
      setWalletToParsePublicKey(publicKey?.toBase58());
    }
  };

  const [sendingType, setSendingType] = useState("");

  return (
    <div className="container mx-auto max-w-6xl p-8 2xl:px-0">
      <div className={styles.container}>
        <div className="navbar mb-2 shadow-lg bg-neutral text-neutral-content rounded-box flex justify-around">
          <div className="flex-1 px-2">
            <div className="text-sm breadcrumbs">
              <ul className="text-xs sm:text-xl">
                <li>
                  <Link href="/">
                    <a>SOLANA-TOOLS</a>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex-none">
            <WalletMultiButton className="btn btn-ghost" />
            <ConnectWallet onUseWalletClick={onUseWalletClick} />
          </div>
        </div>

        <div className="text-center pt-2">
          <div className="hero min-h-16 p-0 pt-10">
            <div className="text-center hero-content w-full">
              <div className="w-full">
                <h1 className="mb-5 text-5xl">
                  Multi Send Token <SolanaLogo />
                </h1>
                <h3 className="font-semibold text-xl pb-5">
                  Supports public address, .sol domain name,{" "}
                  <a
                    className="text-[#9B2DCA] underline"
                    target="_blank"
                    href="https://twitter.com/onsol_labs"
                    rel="noreferrer"
                  >
                    ANS
                  </a>{" "}
                  and Twitter handle with @
                </h3>

                {sendingType == "" && (
                  <div>
                    <div className="max-w-4xl mx-auto">
                      <ul className="text-left leading-10">
                        <li
                          className="m-5"
                          onClick={() => {
                            setSendingType("csv");
                          }}
                        >
                          <div className="p-4 hover:border">
                            <a className="text-4xl font-bold mb-5">
                              Upload CSV file
                            </a>
                            <div>
                              Use a CSV file to multi send tokens and solana
                              domains
                            </div>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {sendingType != "" && (
                  <div className="flex">
                    <button
                      className="text-white font-semibold text-xl w-[6rem] h-[2rem] mb-2 bg-[#2C3B52] hover:bg-[#566274] rounded-xl border"
                      onClick={() => {
                        setSendingType("");
                      }}
                    >
                      ← Back
                    </button>
                  </div>
                )}
                {sendingType == "csv" && <CSV />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function CSV() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey } = useWallet();
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isUploaded, setIsUploaded] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("");
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [currentTx, setCurrentTx] = useState<number | null>(null);
  const [totalTx, setTotalTx] = useState<number | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const parser = new TldParser(connection);

  const handleFileChange = async (event: any) => {
    setError("");
    setSuccess(false);
    const csvFile = event.target.files[0];
    const fileName = csvFile["name"];
    setFileName(fileName);
    const fileType = csvFile["type"];

    if (fileType != "text/csv") {
      setError("It is not a CSV file!");
    } else {
      setIsUploaded(true);
      Papa.parse(event.target.files[0], {
        header: false,
        skipEmptyLines: true,
        complete: function (results) {
          const rowsArray: any = [];

          // Iterating data to get column name
          results.data.map((d: any) => {
            rowsArray.push(Object.keys(d));
          });

          // Parsed Data Response in array format
          // @ts-ignore
          setCsvData(results.data);

          // get the headers of the CSV file
          setCsvHeaders(rowsArray[0]);
        },
      });
    }
  };

  const send = async () => {
    if (publicKey != null) {
      try {
        if (csvData.length != 0) {
          setIsSending(true);
          setSuccess(false);
          setError("");

          const nbTransferPerTx = 5;
          let nbTx: number;
          if (csvData.length % nbTransferPerTx == 0) {
            nbTx = csvData.length / nbTransferPerTx;
          } else {
            nbTx = Math.floor(csvData.length / nbTransferPerTx) + 1;
          }
          setTotalTx(nbTx);

          for (let i = 0; i < nbTx; i++) {
            let Tx = new Transaction();

            let bornSup: number;

            if (i == nbTx - 1) {
              bornSup = csvData.length;
            } else {
              bornSup = nbTransferPerTx * (i + 1);
            }

            setCurrentTx(i + 1);
            for (let j = nbTransferPerTx * i; j < bornSup; j++) {
              const receiver = csvData[j][csvHeaders[0]];
              console.log(receiver)
              let receiverPubkey: PublicKey;
              if (receiver.includes(".sol")) {
                const hashedName = await getHashedName(
                  receiver.replace(".sol", "")
                );
                const nameAccountKey = await getNameAccountKey(
                  hashedName,
                  undefined,
                  new PublicKey("58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx") // SOL TLD Authority
                );
                const owner = await NameRegistryState.retrieve(
                  connection,
                  nameAccountKey
                );
                receiverPubkey = owner.registry.owner;
              } else if (!receiver.includes(".sol") && receiver.includes(".")) {
                const owner = await parser.getOwnerFromDomainTld(receiver);
                if (owner != undefined) {
                  receiverPubkey = owner;
                  console.log(receiverPubkey.toBase58());
                } else {
                  receiverPubkey = new PublicKey("");
                }
              } else if (receiver.includes("@")) {
                const handle = receiver.replace("@", "");
                const registry = await getTwitterRegistry(connection, handle);
                receiverPubkey = registry.owner;
              } else if (
                !receiver.includes(".") &&
                !receiver.includes("@") &&
                !isValidSolanaAddress(receiver)
              ) {
                console.error("Invalid Solana address:", receiver);
                continue; // Skip this iteration of the loop
              } else {
                receiverPubkey = new PublicKey(receiver);
              }

              const token = csvData[j][csvHeaders[1]];
              const amount = parseFloat(csvData[j][csvHeaders[2]]);

              if (token == "So11111111111111111111111111111111111111112") {
                Tx.add(
                  SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: receiverPubkey,
                    lamports: amount * LAMPORTS_PER_SOL,
                  })
                );
              } else if (token.includes(".sol")) {
                const transferDomainIx = await transferNameOwnership(
                  connection,
                  token.replace(".sol", ""),
                  receiverPubkey,
                  undefined,
                  new PublicKey("58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx") // SOL TLD Authority
                );

                Tx.add(transferDomainIx);
              } else {
                const mint = new PublicKey(token);
                const destination_account =
                  await Token.getAssociatedTokenAddress(
                    ASSOCIATED_TOKEN_PROGRAM_ID,
                    TOKEN_PROGRAM_ID,
                    mint,
                    receiverPubkey
                  );
                const account = await connection.getAccountInfo(
                  destination_account
                );

                if (account == null) {
                  const createIx =
                    Token.createAssociatedTokenAccountInstruction(
                      ASSOCIATED_TOKEN_PROGRAM_ID,
                      TOKEN_PROGRAM_ID,
                      mint,
                      destination_account,
                      receiverPubkey,
                      publicKey
                    );

                  Tx.add(createIx);
                }
                const source_account = await Token.getAssociatedTokenAddress(
                  ASSOCIATED_TOKEN_PROGRAM_ID,
                  TOKEN_PROGRAM_ID,
                  mint,
                  publicKey
                );
                const balanceResp = await connection.getTokenAccountBalance(
                  source_account
                );
                const decimals = balanceResp.value.decimals;
                const TransferIx = Token.createTransferInstruction(
                  TOKEN_PROGRAM_ID,
                  source_account,
                  destination_account,
                  publicKey,
                  [],
                  amount * 10 ** decimals
                );
                Tx.add(TransferIx);
              }
            }
            const signature = await wallet.sendTransaction(Tx, connection);
            const confirmed = await connection.confirmTransaction(
              signature,
              "processed"
            );
            console.log("confirmation", signature);
          }
          setSuccess(true);
          setIsSending(false);
        } else {
          setError("The CSV file is empty");
        }
      } catch (error) {
        console.log(error);
        setIsSending(false);
        setSuccess(false);
        const err = (error as any)?.message;
        if (
          err.includes(
            "Cannot read properties of undefined (reading 'public_keys')"
          )
        ) {
          setError("It is not a valid Backpack username");
        } else {
          setError(err);
        }
      }
    }
  };

  return (
    <div>
      <h1 className="font-bold mb-5 text-3xl uppercase">Upload CSV file</h1>
      <div className="font-semibold text-xl">
        The file has to respect the following order:
        <br />{" "}
        <strong>receiver&apos;s address, token address, amount to send</strong>
      </div>
      <form className="mt-[5%] mb-4">
        <label
          htmlFor="file"
          className="text-white font-semibold text-xl rounded-full shadow-xl bg-[#414e63] border px-6 py-2 h-[40px] mb-[3%] uppercase hover:bg-[#2C3B52] hover:cursor-pointer"
        >
          Select file
          <input
            id="file"
            type="file"
            name="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>
      </form>

      {fileName != "" && (
        <div className="text-white font-semibold text-xl mb-2">
          {fileName} uploaded!
        </div>
      )}

      {!isSending && isUploaded && (
        <button
          className="mt-4 text-white font-semibold text-xl bg-[#414e63] hover:bg-[#2C3B52] w-[160px] rounded-full shadow-xl border"
          onClick={send}
        >
          Send
        </button>
      )}
      {isSending && (
        <button className="mt-4 text-white font-semibold text-xl bg-[#414e63] hover:bg-[#2C3B52] w-[160px] rounded-full shadow-xl border">
          <svg
            role="status"
            className="inline mr-3 w-4 h-4 text-white animate-spin"
            viewBox="0 0 100 101"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
              fill="#E5E7EB"
            />
            <path
              d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
              fill="currentColor"
            />
          </svg>
          Sending
        </button>
      )}

      {success && (
        <div className="font-semibold text-xl mt-4">✅ Successfuly sent!</div>
      )}

      {isSending && currentTx != 0 && totalTx != 0 && (
        <div className="font-semibold mt-4 mb-2 text-xl">
          Please confirm Tx: {currentTx}/{totalTx}
        </div>
      )}

      {error != "" && (
        <div className="mt-4 font-semibold text-xl">❌ {error}</div>
      )}
    </div>
  );
}


const isValidSolanaAddress = (address: string) => {
  try {
    // this fn accepts Base58 character
    // and if it pass we suppose Solana address is valid
    new PublicKey(address);
    return true;
  } catch (error) {
    // Non-base58 character or can't be used as Solana address
    return false;
  }
};
