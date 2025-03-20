export default function Test(){
    const { data, error, loading } = useBasic();
    return(
        <div>
            <h1>API Response</h1>
            <p>This is the output: {data}</p>
            </div>
    )
}